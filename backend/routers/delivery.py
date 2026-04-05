from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from datetime import date, datetime, timedelta, timezone
from database import get_db
import models
from utils import get_current_user

router = APIRouter(prefix="/delivery", tags=["delivery"])

@router.get("/slots")
def get_available_slots(
    delivery_date: date,
    db: Session = Depends(get_db)
):
    """
    Fetch all delivery slots and their availability for a given date.
    Cutoff: Slot starts in < 2 hours (only for today).
    Capacity: orders_in_slot < max_orders.
    """
    # 1. Fetch Master Slots
    slots = db.execute(select(models.DeliverySlot)).scalars().all()
    
    # 2. Get Order Counts per Slot for this Date
    # We only count active orders (not cancelled)
    counts_res = db.execute(
        select(models.Order.slot_id, func.count(models.Order.id))
        .where(
            func.date(models.Order.delivery_date) == delivery_date,
            models.Order.status != "cancelled"
        )
        .group_by(models.Order.slot_id)
    ).all()
    counts_map = {r[0]: r[1] for r in counts_res if r[0] is not None}

    now = datetime.now(timezone.utc)
    # Convert delivery_date to naive or compare carefully
    is_today = (delivery_date == date.today())
    
    result = []
    for s in slots:
        current_orders = counts_map.get(s.id, 0)
        is_full = current_orders >= s.max_orders
        
        # Cutoff check: 2 hours before start
        is_closed = False
        if is_today:
            try:
                # s.start_time is "HH:MM", we combine with today's date
                start_dt = datetime.combine(date.today(), datetime.strptime(s.start_time, "%H:%M").time())
                # Assign local timezone or UTC depending on server config.
                # For safety, let's assume server/db time is what matters.
                # If we want to be strict with UTC, we would need to know the offset.
                # Let's use naive compare if DB is naive, but usually datetime.now() is best.
                diff = start_dt - datetime.now() 
                if diff < timedelta(hours=2):
                    is_closed = True
            except:
                pass

        result.append({
            "slot_id": s.id,
            "name": s.name,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "is_available": (not is_full) and (not is_closed),
            "status": "full" if is_full else ("closed" if is_closed else "available")
        })

    return {
        "date": delivery_date.isoformat(),
        "slots": result
    }
