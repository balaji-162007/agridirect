"""routers/products.py  –  public product listing"""
import math
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from database import get_db
from models import Product, User, Review
from utils import get_full_url

router = APIRouter()

def _p(p: Product, avg=None):
    f = p.farmer
    return {
        "id": p.id, "name": p.name, "name_ta": p.name_ta,
        "category": p.category, "product_type": p.product_type,
        "price": p.price, "unit": p.unit, "quantity": p.quantity,
        "harvest_date": p.harvest_date.isoformat() if p.harvest_date else None,
        "description": p.description, 
        "images": [get_full_url(img) for img in (p.images or [])],
        "price_history": p.price_history or [],
        "price_updated_at": p.price_updated_at.isoformat() if p.price_updated_at else None,
        "market_price": p.market_price, "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "farmer_id": f.id, "farmer_name": f.name,
        "farmer_farm": f.farm_name, "farmer_location": f.location,
        "farmer_photo": get_full_url(f.profile_photo),
        "avg_rating": round(avg, 1) if avg else None,
    }

@router.get("")
def list_products(
    search: Optional[str] = None, category: Optional[str] = None,
    product_type: Optional[str] = None, farmer_name: Optional[str] = None,
    location: Optional[str] = None, min_price: Optional[float] = None,
    max_price: Optional[float] = None, featured: Optional[bool] = None,
    sort: str = "newest", page: int = Query(1, ge=1), limit: int = Query(12, le=50),
    db: Session = Depends(get_db),
):
    q = select(Product).join(Product.farmer).where(Product.is_active == True)
    if search:
        t = f"%{search}%"
        q = q.where(or_(Product.name.ilike(t), Product.name_ta.ilike(t),
                        Product.description.ilike(t), User.name.ilike(t)))
    if category:     q = q.where(Product.category == category.lower())
    if product_type: q = q.where(Product.product_type == product_type)
    if farmer_name:  q = q.where(User.name.ilike(f"%{farmer_name}%"))
    if location:     q = q.where(User.location.ilike(f"%{location}%"))
    if min_price is not None: q = q.where(Product.price >= min_price)
    if max_price is not None: q = q.where(Product.price <= max_price)
    q = q.order_by({"newest":Product.created_at.desc(),"price_asc":Product.price.asc(),
                    "price_desc":Product.price.desc(),"name":Product.name.asc()}.get(sort, Product.created_at.desc()))
    total = (db.execute(select(func.count()).select_from(q.subquery().alias("t")))).scalar_one()
    res   = db.execute(q.offset((page-1)*limit).limit(limit).options(selectinload(Product.farmer)))
    prods = res.scalars().all()
    return {"products": [_p(p) for p in prods], "total": total, "page": page, "pages": math.ceil(total/limit)}

@router.get("/categories/counts")
def cat_counts(db: Session = Depends(get_db)):
    cats = ["vegetables","fruits","grains","dairy"]
    out = {}; total = 0
    for c in cats:
        n = (db.execute(select(func.count(Product.id)).where(Product.category==c, Product.is_active==True))).scalar_one()
        out[c] = n; total += n
    out["total"] = total
    return out

@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    res = db.execute(
        select(Product).options(selectinload(Product.farmer), selectinload(Product.reviews))
        .where(Product.id == product_id))
    p = res.scalar_one_or_none()
    if not p: raise HTTPException(404, "Product not found")
    avg = (db.execute(select(func.avg(Review.overall_service)).where(Review.product_id==product_id))).scalar_one_or_none()
    return _p(p, avg)

@router.get("/{product_id}/reviews")
def product_reviews(product_id: int, page: int = 1, limit: int = 10,
                          db: Session = Depends(get_db)):
    q = select(Review).options(selectinload(Review.customer)).where(Review.product_id==product_id)\
        .order_by(Review.created_at.desc()).offset((page-1)*limit).limit(limit)
    res = db.execute(q)
    reviews = res.scalars().all()
    total = (db.execute(select(func.count(Review.id)).where(Review.product_id==product_id))).scalar_one()
    return {"reviews": [{"id":r.id,"customer_name":r.customer.name,"product_quality":r.product_quality,
        "delivery_time":r.delivery_time,"overall_service":r.overall_service,
        "comment":r.comment,"created_at":r.created_at.isoformat()} for r in reviews], "total": total}
