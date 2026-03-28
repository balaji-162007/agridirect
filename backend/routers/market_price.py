"""routers/market_price.py"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from database import get_db
from models import MarketPrice, District

router = APIRouter()

@router.get("/districts")
def get_districts(db: Session = Depends(get_db)):
    """Get all districts for filtering"""
    q = select(District).order_by(District.name)
    res = db.execute(q)
    districts = res.scalars().all()
    return {"districts": [{"id": d.id, "name": d.name, "name_ta": d.name_ta} for d in districts]}

@router.get("")
def get_prices(
    category: Optional[str] = None, 
    district_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get market prices with optional filtering by category and district"""
    q = select(MarketPrice).options(selectinload(MarketPrice.district))
    
    if category: 
        q = q.where(MarketPrice.category == category.lower())
    if district_id:
        q = q.where(MarketPrice.district_id == district_id)
        
    q = q.order_by(MarketPrice.category, MarketPrice.name)
    res = db.execute(q)
    prices = res.scalars().all()
    
    return {"prices": [{
        "id": p.id,
        "name": p.name,
        "name_ta": p.name_ta,
        "category": p.category,
        "price": p.price,
        "change_pct": p.change_pct,
        "market": p.market,
        "district_id": p.district_id,
        "district_name": p.district.name if p.district else None,
        "updated_at": p.updated_at.isoformat() if hasattr(p.updated_at, 'isoformat') else str(p.updated_at) if p.updated_at else None
    } for p in prices]}
