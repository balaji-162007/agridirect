"""routers/reviews.py"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import Review, Order, User, Product
from utils import get_current_customer

router = APIRouter()

class ReviewReq(BaseModel):
    order_id: Optional[int] = None
    product_id: Optional[int] = None
    farmer_id: Optional[int] = None
    product_quality: int; delivery_time: int; overall_service: int
    comment: Optional[str] = None

@router.post("")
def create_review(body: ReviewReq, db: Session = Depends(get_db),
                        customer: User = Depends(get_current_customer)):
    if body.order_id:
        res = db.execute(select(Order).options(selectinload(Order.items))
            .where(Order.id==body.order_id, Order.customer_id==customer.id))
        o = res.scalar_one_or_none()
        if not o: raise HTTPException(404, "Order not found")
        if o.status != "delivered": raise HTTPException(400, "Can only review delivered orders")
        if o.reviewed: raise HTTPException(400, "Already reviewed")
        for v in [body.product_quality, body.delivery_time, body.overall_service]:
            if not 1 <= v <= 5: raise HTTPException(400, "Ratings must be 1-5")
        for item in (o.items or []):
            db.add(Review(order_id=o.id, product_id=item.product_id,
                          farmer_id=o.farmer_id, customer_id=customer.id,
                          product_quality=body.product_quality,
                          delivery_time=body.delivery_time,
                          overall_service=body.overall_service,
                          comment=body.comment))
        o.reviewed = True
    elif body.product_id:
        # General product review without order_id
        res = db.execute(select(Product).where(Product.id == body.product_id))
        p = res.scalar_one_or_none()
        if not p: raise HTTPException(404, "Product not found")
        for v in [body.product_quality, body.delivery_time, body.overall_service]:
            if not 1 <= v <= 5: raise HTTPException(400, "Ratings must be 1-5")
        db.add(Review(product_id=p.id, farmer_id=p.farmer_id, customer_id=customer.id,
                      product_quality=body.product_quality,
                      delivery_time=body.delivery_time,
                      overall_service=body.overall_service,
                      comment=body.comment))
    elif body.farmer_id:
        # General farmer review from homepage
        res = db.execute(select(User).where(User.id == body.farmer_id, User.role == "farmer"))
        f = res.scalar_one_or_none()
        if not f: raise HTTPException(404, "Farmer not found")
        for v in [body.product_quality, body.delivery_time, body.overall_service]:
            if not 1 <= v <= 5: raise HTTPException(400, "Ratings must be 1-5")
        db.add(Review(farmer_id=f.id, customer_id=customer.id,
                      product_quality=body.product_quality,
                      delivery_time=body.delivery_time,
                      overall_service=body.overall_service,
                      comment=body.comment))
    else:
        raise HTTPException(400, "Either order_id, product_id, or farmer_id must be provided")

    db.flush()
    return {"message": "Review submitted"}

@router.post("/platform")
def create_platform_review(body: dict, db: Session = Depends(get_db),
                                 customer: User = Depends(get_current_customer)):
    comment = body.get("comment", "").strip()
    rating  = int(body.get("overall_service", 5))
    if not comment: raise HTTPException(400, "Comment required")
    
    # Use a dummy product_id or order_id if needed, or make them optional in model
    # For now, let's just add a review entry with null product/order
    # Wait, the model might require them. Let me check.
    # Actually, I'll just save it as a review where product_id is null (if I update model)
    # OR create a new PlatformReview model.
    # To keep it simple, I'll update the Review model to allow null order_id/product_id
    db.add(Review(customer_id=customer.id, farmer_id=None, product_id=None,
                  product_quality=rating, delivery_time=rating, overall_service=rating,
                  comment=comment))
    db.flush()
    return {"message": "Review submitted"}

@router.get("/featured")
def get_featured_reviews(db: Session = Depends(get_db)):
    # Fetch 3 most recent high-rated reviews
    res = db.execute(
        select(Review).options(selectinload(Review.customer), selectinload(Review.farmer))
        .where(Review.overall_service >= 4)
        .order_by(Review.created_at.desc())
        .limit(3)
    )
    reviews = res.scalars().all()
    return {"reviews": [{
        "id": r.id, 
        "customer_name": r.customer.name if r.customer else "Anonymous",
        "farmer_name": r.farmer.name if r.farmer else None,
        "overall_service": r.overall_service, 
        "comment": r.comment,
        "created_at": r.created_at.isoformat()
    } for r in reviews]}

@router.get("/customer")
def my_reviews(db: Session = Depends(get_db), customer: User = Depends(get_current_customer)):
    res = db.execute(select(Review).options(selectinload(Review.product))
        .where(Review.customer_id==customer.id).order_by(Review.created_at.desc()))
    reviews = res.scalars().all()
    return {"reviews": [{"id":r.id,"product_name":r.product.name if r.product else "—",
        "product_quality":r.product_quality,"delivery_time":r.delivery_time,
        "overall_service":r.overall_service,"comment":r.comment,
        "created_at":r.created_at.isoformat()} for r in reviews]}

@router.get("/farmer")
def farmer_reviews_pub(farmer_id: int, db: Session = Depends(get_db)):
    res = db.execute(select(Review).options(selectinload(Review.customer),selectinload(Review.product))
        .where(Review.farmer_id==farmer_id).order_by(Review.created_at.desc()))
    reviews = res.scalars().all()
    return {"reviews": [{"id":r.id,"customer_name":r.customer.name,"product_name":r.product.name if r.product else "—",
        "product_quality":r.product_quality,"delivery_time":r.delivery_time,
        "overall_service":r.overall_service,"comment":r.comment,
        "created_at":r.created_at.isoformat()} for r in reviews]}
