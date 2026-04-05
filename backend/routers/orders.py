"""routers/orders.py
Python 3.13 fix:
  - place_order() is called both as a FastAPI endpoint (via Depends) AND directly
    from main.py's verify_payment. The Depends injected parameters must have
    defaults so direct calls work without FastAPI's DI system.
"""
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import Order, OrderItem, Product, User, Notification
from utils import get_current_user, get_current_farmer, get_current_customer

router = APIRouter()


class ItemIn(BaseModel):
    product_id: int
    qty: float
    price: float


class AddrIn(BaseModel):
    name: str
    phone: str
    line1: str
    line2: Optional[str] = None
    city: str
    state: str = "TN"
    pincode: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


def calculate_distance(lat1, lon1, lat2, lon2):
    """Haversine formula to calculate distance in km"""
    import math
    if None in (lat1, lon1, lat2, lon2): return 0
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) * math.sin(dlat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) * math.sin(dlon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class PlaceOrderReq(BaseModel):
    items: List[ItemIn]
    delivery_address: AddrIn
    delivery_method: str
    payment_method: str
    subtotal: float
    delivery_charge: float = 0
    total: float
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    # ── Delivery Date ──
    delivery_date: Optional[str] = None # ISO format "YYYY-MM-DD"


def _o(o: Order):
    # Ensure created_at has UTC timezone if naive (SQLite)
    created_at = o.created_at
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    return {
        "id": o.id, "status": o.status,
        "delivery_method": o.delivery_method, "payment_method": o.payment_method,
        "payment_status": o.payment_status,
        "subtotal": o.subtotal, "delivery_charge": o.delivery_charge, "total": o.total,
        "delivery_address": o.delivery_address, "status_history": o.status_history or [],
        "reviewed": o.reviewed,
        "created_at": created_at.isoformat() if created_at else None,
        "delivery_date": o.delivery_date.isoformat() if o.delivery_date else None,
        "customer_name": o.customer.name if o.customer else None,
        "customer_phone": o.customer.phone if o.customer else None,
        "farmer_name":   o.farmer.name   if o.farmer   else None,
        "items": [
            {"product_id": i.product_id, "product_name": i.product_name, "qty": i.qty, "price": i.price}
            for i in (o.items or [])
        ],
    }


# FIX: place_order is called directly from main.py (verify_payment) with explicit
# db and customer args, bypassing FastAPI's dependency injection.
# Keep Depends() for normal endpoint use, but accept direct args too.
@router.post("", status_code=status.HTTP_201_CREATED)
def place_order(
    body: PlaceOrderReq,
    db: Session = Depends(get_db),
    customer: User = Depends(get_current_customer),
):
    if not body.items:
        raise HTTPException(400, "No items")
    
    # Get farmer and product
    res = db.execute(select(Product).options(selectinload(Product.farmer)).where(Product.id == body.items[0].product_id))
    prod = res.scalar_one_or_none()
    if not prod:
        raise HTTPException(404, "Product not found")
    farmer = prod.farmer

    delivery_charge = body.delivery_charge
    total = body.total
    
    # Farmer Delivery System Logic
    if body.delivery_method == "farmer_delivery":
        # 1. Calculate distance
        dist = calculate_distance(
            farmer.latitude, farmer.longitude, 
            body.delivery_address.latitude, body.delivery_address.longitude
        )
        
        # 2. Calculate total quantity in kg
        total_qty = sum(item.qty for item in body.items)
        
        # 3. Check Eligibility
        if total_qty > farmer.max_carrying_capacity:
            raise HTTPException(400, f"Order exceeds farmer's maximum carrying capacity ({farmer.max_carrying_capacity} kg). Reduce quantity.")
        
        if dist > farmer.max_delivery_distance:
            raise HTTPException(400, f"Delivery address is beyond farmer's maximum delivery distance ({farmer.max_delivery_distance} km).")
            
        # 4. Dynamic constraint: allowed_quantity based on distance
        allowed_qty = farmer.max_carrying_capacity * (1 - (dist / farmer.max_delivery_distance))
        if total_qty > allowed_qty:
            raise HTTPException(400, f"For this distance ({dist:.1f} km), the maximum allowed quantity is {allowed_qty:.1f} kg. Current: {total_qty} kg.")
            
        # 5. Calculate Cost (Standard Platform Rates)
        BASE_FEE = 20
        PER_KM = 5
        PER_KG = 2
        calculated_charge = BASE_FEE + (dist * PER_KM) + (total_qty * PER_KG)
        
        delivery_charge = round(calculated_charge, 2)
        total = round(body.subtotal + delivery_charge, 2)

    # ── Slot Validation ──
    d_date = None
    if body.delivery_date:
        try:
            d_date = datetime.fromisoformat(body.delivery_date)
        except:
            raise HTTPException(400, "Invalid delivery_date format")

    o = Order(
        customer_id=customer.id,
        farmer_id=prod.farmer_id,
        delivery_method=body.delivery_method,
        payment_method=body.payment_method,
        payment_status="paid" if body.payment_method == "online" else "pending",
        subtotal=body.subtotal,
        delivery_charge=delivery_charge,
        total=total,
        delivery_address=body.delivery_address.model_dump(),
        delivery_date=d_date,
        status_history=[{"status": "placed", "timestamp": datetime.now(timezone.utc).isoformat()}],
        razorpay_order_id=body.razorpay_order_id,
        razorpay_payment_id=body.razorpay_payment_id,
    )
    db.add(o)
    db.flush()
    for it in body.items:
        p = db.get(Product, it.product_id)
        if not p:
            raise HTTPException(404, f"Product {it.product_id} not found")
        if p.quantity < it.qty:
            raise HTTPException(400, f"Insufficient stock for {p.name}. Available: {p.quantity}")
        
        db.add(OrderItem(
            order_id=o.id, product_id=it.product_id,
            product_name=p.name, qty=it.qty, price=it.price,
        ))
        p.quantity -= it.qty
    db.flush()

    # Notify farmer
    db.add(Notification(
        user_id=o.farmer_id,
        title="New Order Received!",
        message=f"You received order #{o.id} from {customer.name} for ₹{o.total}.",
        type="order_placed",
        order_id=o.id,
        link=f"farmer-dashboard.html?panel=orders&order_id={o.id}"
    ))
    db.flush()

    return {"message": "Order placed", "order_id": o.id}


@router.get("/customer")
def customer_orders(db: Session = Depends(get_db), customer: User = Depends(get_current_customer)):
    res = db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.customer), selectinload(Order.farmer))
        .where(Order.customer_id == customer.id)
        .order_by(Order.created_at.desc())
    )
    return {"orders": [_o(o) for o in res.scalars().all()]}


@router.get("/farmer")
def farmer_orders(limit: int = 100, db: Session = Depends(get_db), farmer: User = Depends(get_current_farmer)):
    res = db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.customer), selectinload(Order.farmer))
        .where(Order.farmer_id == farmer.id)
        .order_by(Order.created_at.desc())
        .limit(limit)
    )
    return {"orders": [_o(o) for o in res.scalars().all()]}


@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    res = db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.customer), selectinload(Order.farmer))
        .where(Order.id == order_id)
    )
    o = res.scalar_one_or_none()
    if not o:
        raise HTTPException(404, "Not found")
    if o.customer_id != user.id and o.farmer_id != user.id:
        raise HTTPException(403, "Access denied")
    return _o(o)


@router.put("/{order_id}/status")
def update_status(
    order_id: int, body: dict,
    db: Session = Depends(get_db),
    farmer: User = Depends(get_current_farmer),
):
    s = body.get("status", "")
    valid = ["placed", "confirmed", "out_for_delivery", "delivered", "cancelled"]
    if s not in valid:
        raise HTTPException(400, "Invalid status")
    res = db.execute(select(Order).where(Order.id == order_id, Order.farmer_id == farmer.id))
    o = res.scalar_one_or_none()
    if not o:
        raise HTTPException(404, "Order not found")
    
    if o.status in ["delivered", "cancelled"]:
        raise HTTPException(400, "Finalized orders cannot be modified.")
        
    o.status = s
    hist = o.status_history or []
    # Avoid duplicate history for same status if re-selected
    if not any(h.get("status") == s for h in hist):
        hist.append({"status": s, "timestamp": datetime.now(timezone.utc).isoformat()})
        o.status_history = hist
    if s == "delivered" and o.payment_method == "cod":
        o.payment_status = "paid"
    db.commit()
    return {"message": "Status updated", "status": s}

@router.put("/{order_id}/cancel")
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    customer: User = Depends(get_current_customer),
):
    from datetime import timedelta
    
    res = db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.customer), selectinload(Order.farmer))
        .where(Order.id == order_id, Order.customer_id == customer.id)
    )
    o = res.scalar_one_or_none()
    if not o:
        raise HTTPException(404, "Order not found")
    
    if o.status != "placed":
        raise HTTPException(400, "Only orders in 'placed' status can be cancelled.")
    
    # Ensure created_at has UTC timezone before comparison
    created_at = o.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
        
    diff = datetime.now(timezone.utc) - created_at
    if diff > timedelta(minutes=30):
        mins = int(diff.total_seconds() / 60)
        raise HTTPException(400, f"Cancellation window (30 mins) has expired. {mins} minutes passed.")
    
    # Update status
    o.status = "cancelled"
    hist = o.status_history or []
    hist.append({"status": "cancelled", "timestamp": datetime.now(timezone.utc).isoformat(), "by": "customer"})
    o.status_history = hist
    
    # Restore Stock
    for item in o.items:
        p = db.get(Product, item.product_id)
        if p:
            p.quantity += item.qty
            
    # Notify Farmer
    db.add(Notification(
        user_id=o.farmer_id,
        title="Order Cancelled",
        message=f"Customer {customer.name} cancelled order #{o.id}.",
        type="order_cancelled",
        order_id=o.id,
        link="farmer-dashboard.html?panel=orders"
    ))
    
    db.commit()
    return {"message": "Order cancelled successfully and stock restored."}
