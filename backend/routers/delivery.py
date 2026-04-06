from fastapi import APIRouter, Query
from datetime import datetime
from typing import List, Optional

router = APIRouter()

@router.get("/slots")
async def get_slots(delivery_date: str = Query(...)):
    """
    Returns available delivery slots for a given date.
    Calculates availability based on 'now' for the current/next day.
    """
    now = datetime.now()
    date_obj = datetime.strptime(delivery_date, "%Y-%m-%d")
    is_today = date_obj.date() == now.date()
    
    # Standard slots
    slots = [
        {
            "slot_id": 1,
            "name": "Morning",
            "start_time": "08:00 AM",
            "end_time": "11:00 AM",
            "cutoff_hour": 7, # 7 AM
            "is_available": True
        },
        {
            "slot_id": 2,
            "name": "Afternoon",
            "start_time": "12:00 PM",
            "end_time": "03:00 PM",
            "cutoff_hour": 11, # 11 AM
            "is_available": True
        },
        {
            "slot_id": 3,
            "name": "Evening",
            "start_time": "05:00 PM",
            "end_time": "08:00 PM",
            "cutoff_hour": 16, # 4 PM
            "is_available": True
        }
    ]
    
    # Availability logic for same-day delivery
    for slot in slots:
        if is_today and now.hour >= slot["cutoff_hour"]:
            slot["is_available"] = False
            slot["status"] = "closed"
        else:
            # Mocking "full" state randomly or based on business logic
            # For now, all future slots are available
            slot["is_available"] = True
            slot["status"] = "available"
            
    return {"slots": slots}
