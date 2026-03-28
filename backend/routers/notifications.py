from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, update
from database import get_db
from models import Notification, User
from utils import get_current_user

router = APIRouter()

@router.get("")
def get_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    res = db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifs = res.scalars().all()
    return {"notifications": [{
        "id": n.id, "title": n.title, "message": n.message,
        "type": n.type, "link": n.link, "order_id": n.order_id,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat()
    } for n in notifs]}

@router.put("/{notif_id}/read")
def mark_as_read(notif_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.execute(
        update(Notification)
        .where(Notification.id == notif_id, Notification.user_id == user.id)
        .values(is_read=True)
    )
    db.commit()
    return {"message": "Marked as read"}

@router.put("/read-all")
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.id)
        .values(is_read=True)
    )
    db.commit()
    return {"message": "All marked as read"}
