"""routers/auth.py"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import select, delete

from database import get_db
from models import User, OTP, UserRole
from utils import (gen_otp, send_otp, create_token, get_current_user, 
                   get_full_url, OTP_EXPIRE_MINUTES, save_profile_photo,
                   get_signed_url, verify_twilio_otp)

router = APIRouter()

def _norm(phone: str) -> str:
    d = phone.replace("+91","").replace(" ","").replace("-","")
    return f"+91{d[-10:]}"

class SendOTPReq(BaseModel):
    phone: str
    @field_validator("phone")
    @classmethod
    def v(cls, v): return _norm(v)

class VerifyOTPReq(BaseModel):
    phone: str; otp: str
    @field_validator("phone")
    @classmethod
    def v(cls, v): return _norm(v)

class RegisterReq(BaseModel):
    phone: str; otp: str; name: str
    role: str = "customer"
    location: Optional[str] = None
    farm_name: Optional[str] = None
    @field_validator("phone")
    @classmethod
    def vp(cls, v): return _norm(v)
    @field_validator("role")
    @classmethod
    def vr(cls, v):
        if v not in ("farmer","customer"): raise ValueError("Invalid role")
        return v

class ProfileReq(BaseModel):
    name: Optional[str] = None
    farm_name: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None

def _user_resp(user: User, token: str):
    profile_photo = user.profile_photo
    if profile_photo:
        profile_photo = get_signed_url(profile_photo, "profile")
        
    return {"token": token, "user": {
        "id": user.id, "name": user.name, "phone": user.phone,
        "role": user.role, "farm_name": user.farm_name, "location": user.location,
        "bio": user.bio, "profile_photo": profile_photo, 
        "is_verified": user.is_verified,
        "latitude": user.latitude, "longitude": user.longitude,
        "max_delivery_distance": user.max_delivery_distance,
        "max_carrying_capacity": user.max_carrying_capacity,
        "base_delivery_fee": user.base_delivery_fee,
        "cost_per_km": user.cost_per_km,
        "cost_per_kg": user.cost_per_kg
    }}

def _check_otp(db, phone, otp):
    phone = _norm(phone)
    # 1. Check Twilio Verify if configured
    if verify_twilio_otp(phone, otp):
        # Twilio Verify handles verification externally. 
        # Return a mock record to continue the backend flow.
        return OTP(phone=phone, otp=otp, used=True,
                   expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=5))

    # 2. Check local DB record
    r = db.execute(
        select(OTP).where(OTP.phone==phone, OTP.otp==otp, OTP.used==False)
        .order_by(OTP.created_at.desc()))
    row = r.scalar_one_or_none()
    if not row: raise HTTPException(400, "Invalid OTP")
    if row.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(400, "OTP expired. Request a new one.")
    return row

@router.post("/send-otp")
def send_otp_ep(body: SendOTPReq, db: Session = Depends(get_db)):
    phone = _norm(body.phone)
    print(f"DEBUG: auth.router /send-otp called for {phone}")
    db.execute(delete(OTP).where(OTP.phone==phone))
    otp = gen_otp()
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)).replace(tzinfo=None)
    db.add(OTP(phone=phone, otp=otp, expires_at=expires_at))
    db.flush()
    ok = send_otp(phone, otp)
    if not ok: raise HTTPException(503, "Failed to send OTP")
    return {"message": "OTP sent", "phone": phone}

@router.post("/verify-otp")
def verify_otp_ep(body: VerifyOTPReq, db: Session = Depends(get_db)):
    row = _check_otp(db, body.phone, body.otp)
    r = db.execute(select(User).where(User.phone==body.phone))
    user = r.scalar_one_or_none()
    if not user: raise HTTPException(404, "User not found. Please register first.")
    row.used = True
    return _user_resp(user, create_token(user.id, user.role))

@router.post("/register")
async def register(
    phone: str = Form(...),
    otp: str = Form(...),
    name: str = Form(...),
    role: str = Form("customer"),
    location: Optional[str] = Form(None),
    farm_name: Optional[str] = Form(None),
    profile_photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    phone = _norm(phone)
    if role not in ("farmer", "customer"):
        raise HTTPException(400, "Invalid role")

    row = _check_otp(db, phone, otp)
    r = db.execute(select(User).where(User.phone == phone))
    existing = r.scalar_one_or_none()
    if existing:
        row.used = True
        return _user_resp(existing, create_token(existing.id, existing.role))

    user = User(
        phone=phone,
        name=name.strip(),
        role=role,
        location=location,
        farm_name=farm_name
    )
    db.add(user)
    db.flush()

    if profile_photo and profile_photo.filename:
        photo_url = await save_profile_photo(profile_photo, user.id)
        user.profile_photo = photo_url
        db.flush()

    row.used = True
    return _user_resp(user, create_token(user.id, user.role))

@router.put("/profile")
async def update_profile(
    name: Optional[str] = Form(None),
    farm_name: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    profile_photo: Optional[UploadFile] = File(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    max_delivery_distance: Optional[float] = Form(None),
    max_carrying_capacity: Optional[float] = Form(None),
    base_delivery_fee: Optional[float] = Form(None),
    cost_per_km: Optional[float] = Form(None),
    cost_per_kg: Optional[float] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if name:       user.name      = name.strip()
    if farm_name:  user.farm_name = farm_name.strip()
    if location:   user.location  = location.strip()
    if bio is not None: user.bio  = bio
    
    if latitude is not None:              user.latitude = latitude
    if longitude is not None:             user.longitude = longitude
    if max_delivery_distance is not None: user.max_delivery_distance = max_delivery_distance
    if max_carrying_capacity is not None: user.max_carrying_capacity = max_carrying_capacity
    if base_delivery_fee is not None:     user.base_delivery_fee = base_delivery_fee
    if cost_per_km is not None:           user.cost_per_km = cost_per_km
    if cost_per_kg is not None:           user.cost_per_kg = cost_per_kg

    if profile_photo and profile_photo.filename:
        photo_url = await save_profile_photo(profile_photo, user.id)
        user.profile_photo = photo_url

    db.flush()
    
    profile_photo = user.profile_photo
    if profile_photo:
        profile_photo = get_signed_url(profile_photo, "profile")
        
    return {"message": "Profile updated", "user": {
        "name": user.name, "location": user.location,
        "farm_name": user.farm_name, "bio": user.bio,
        "profile_photo": profile_photo,
        "is_verified": user.is_verified,
        "latitude": user.latitude, "longitude": user.longitude,
        "max_delivery_distance": user.max_delivery_distance,
        "max_carrying_capacity": user.max_carrying_capacity,
        "base_delivery_fee": user.base_delivery_fee,
        "cost_per_km": user.cost_per_km,
        "cost_per_kg": user.cost_per_kg
    }}

@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"id":user.id,"name":user.name,"phone":user.phone,"role":user.role,
            "farm_name":user.farm_name,"location":user.location,"bio":user.bio,
            "profile_photo":get_full_url(user.profile_photo), "is_verified":user.is_verified}
