"""
utils.py  –  JWT, OTP, image compression, helpers
Python 3.13 fixes:
  - passlib's CryptContext with bcrypt now requires bcrypt>=4.1.0.
    passlib 1.7.4 tries to import the removed `crypt` stdlib module on 3.13;
    we work around this by patching the bcrypt handler before first use.
"""
import os, random, string, uuid, io, logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from pathlib import Path

# ── passlib / bcrypt Python 3.13 compatibility patch ──────────────────────────
# passlib 1.7.4 calls `crypt.methods` at import time on some code paths.
# Providing a stub prevents the ImportError on Python 3.13 where `crypt` was
# removed (PEP 594).
import sys
if "crypt" not in sys.modules:
    import types
    _crypt_stub = types.ModuleType("crypt")
    _crypt_stub.methods = []          # type: ignore[attr-defined]
    _crypt_stub.crypt = lambda *a, **k: ""  # type: ignore[attr-defined]
    sys.modules["crypt"] = _crypt_stub

from passlib.context import CryptContext  # noqa: E402  (import after patch)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import select
import httpx
from PIL import Image
from supabase import create_client

from database import get_db

logger = logging.getLogger(__name__)

# ── Config ──────────────────────────────────────────────────────────────────
SECRET_KEY        = os.getenv("SECRET_KEY", "agridirect-secret-change-in-production")
ALGORITHM         = "HS256"
TOKEN_EXPIRE_DAYS = 30

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase: {e}")

OTP_PROVIDER       = os.getenv("OTP_PROVIDER", "mock")  # mock | twilio | msg91
TWILIO_SID         = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN       = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM        = os.getenv("TWILIO_FROM_NUMBER", "")
MSG91_KEY          = os.getenv("MSG91_API_KEY", "")
MSG91_SENDER       = os.getenv("MSG91_SENDER_ID", "AGRIDR")
MSG91_TEMPLATE     = os.getenv("MSG91_TEMPLATE_ID", "")
OTP_EXPIRE_MINUTES = 10

UPLOAD_DIR    = os.getenv("UPLOAD_DIR", "uploads/product_images")
MAX_IMG_BYTES = 5 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = 1200
JPEG_QUALITY  = 82

Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(UPLOAD_DIR + "/thumbs").mkdir(parents=True, exist_ok=True)

security = HTTPBearer(auto_error=False)


# ── JWT ──────────────────────────────────────────────────────────────────────
def create_token(user_id: int, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "role": role, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ── Current-user deps ────────────────────────────────────────────────────────
def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
):
    from models import User
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user

def get_current_farmer(user=Depends(get_current_user)):
    if user.role != "farmer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Farmer access required")
    return user

def get_current_customer(user=Depends(get_current_user)):
    if user.role != "customer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Customer access required")
    return user

def get_optional_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
):
    from models import User
    if not creds:
        return None
    payload = decode_token(creds.credentials)
    if not payload:
        return None
    return db.get(User, int(payload["sub"]))


# ── OTP ──────────────────────────────────────────────────────────────────────
def gen_otp() -> str:
    return "".join(random.choices(string.digits, k=6))

def send_otp(phone: str, otp: str) -> bool:
    msg = f"Your AgriDirect OTP is {otp}. Valid {OTP_EXPIRE_MINUTES} mins. Do not share."
    if OTP_PROVIDER == "twilio" and TWILIO_SID:
        return _twilio(phone, msg)
    if OTP_PROVIDER == "msg91" and MSG91_KEY:
        return _msg91(phone, otp)
    logger.info(f"[MOCK OTP] {phone} → {otp}")
    return True

def _twilio(phone, msg):
    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json"
    with httpx.Client() as c:
        try:
            r = c.post(url, auth=(TWILIO_SID, TWILIO_TOKEN),
                             data={"From": TWILIO_FROM, "To": phone, "Body": msg}, timeout=10)
            return r.status_code in (200, 201)
        except Exception as e:
            logger.error(f"Twilio: {e}"); return False

def _msg91(phone, otp):
    mobile = phone.replace("+91", "").replace(" ", "")
    with httpx.Client() as c:
        try:
            r = c.get("https://api.msg91.com/api/v5/otp", params={
                "authkey": MSG91_KEY, "mobile": f"91{mobile}",
                "message": f"Your AgriDirect OTP is {otp}.",
                "sender": MSG91_SENDER, "otp": otp, "template_id": MSG91_TEMPLATE,
            }, timeout=10)
            return r.json().get("type") == "success"
        except Exception as e:
            logger.error(f"MSG91: {e}"); return False


# ── Image upload & compress ──────────────────────────────────────────────────
async def upload_supabase(content: bytes, filename: str, content_type: str, bucket: str = "product-images") -> str:
    """Helper to upload to Supabase Storage and return public URL"""
    if not supabase:
        raise HTTPException(500, "Supabase storage not configured.")
    try:
        supabase.storage.from_(bucket).upload(
            filename,
            content,
            {"content-type": content_type}
        )
        return supabase.storage.from_(bucket).get_public_url(filename)
    except Exception as e:
        logger.error(f"Supabase upload error: {e}")
        raise HTTPException(500, f"Upload failed: {e}")

async def save_profile_photo(file: UploadFile, user_id: int) -> str:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Unsupported type. Use JPG/PNG/WEBP.")
    data = await file.read()
    if len(data) > MAX_IMG_BYTES:
        raise HTTPException(400, "Image too large (max 5 MB).")
    try:
        img = Image.open(io.BytesIO(data))
    except Exception:
        raise HTTPException(400, "Invalid image file.")

    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    w, h = img.size
    if max(w, h) > 400:
        ratio = 400 / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    fname = f"u{user_id}_{uuid.uuid4().hex}.webp"
    
    # Compress locally first
    out = io.BytesIO()
    img.save(out, format="WEBP", quality=85, optimize=True)
    
    # Upload to Supabase if available, else local
    if supabase:
        return await upload_supabase(out.getvalue(), fname, "image/webp", bucket="profile-photos")

    profile_dir = "uploads/profile_photos"
    Path(profile_dir).mkdir(parents=True, exist_ok=True)
    img.save(f"{profile_dir}/{fname}", format="WEBP", quality=85, optimize=True)
    return f"/uploads/profile_photos/{fname}"


async def save_image(file: UploadFile, farmer_id: int) -> str:
    content_type = getattr(file, "content_type", "") or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Unsupported type. Use JPG/PNG/WEBP.")
    data = await file.read()
    if len(data) > MAX_IMG_BYTES:
        raise HTTPException(400, "Image too large (max 5 MB).")
    try:
        img = Image.open(io.BytesIO(data))
    except Exception:
        raise HTTPException(400, "Invalid image file.")

    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    w, h = img.size
    if max(w, h) > MAX_DIMENSION:
        ratio = MAX_DIMENSION / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    fname = f"{farmer_id}_{uuid.uuid4().hex}.webp"

    # Upload to Supabase if available
    if supabase:
        out = io.BytesIO()
        img.save(out, format="WEBP", quality=JPEG_QUALITY, optimize=True)
        return await upload_supabase(out.getvalue(), fname, "image/webp", bucket="product-images")

    img.save(f"{UPLOAD_DIR}/{fname}", format="WEBP", quality=JPEG_QUALITY, optimize=True)

    thumb = img.copy()
    thumb.thumbnail((400, 400), Image.LANCZOS)
    thumb.save(f"{UPLOAD_DIR}/thumbs/{fname}", format="WEBP", quality=72, optimize=True)

    logger.info(f"Saved image: {fname}")
    return f"/uploads/product_images/{fname}"

def get_signed_url(filename: str, image_type: str):
    bucket_name = "product-images" if image_type == "product" else "profile-photos"
    
    # QUICK DEBUG
    print("USING BUCKET:", bucket_name)

    result = supabase.storage.from_(bucket_name).create_signed_url(
        filename.split("/")[-1],
        60 * 60 * 24 * 7
    )

    signed_path = result["signedURL"] if isinstance(result, dict) else result

    if signed_path.startswith("/"):
        return f"{SUPABASE_URL}{signed_path}"

    return signed_path

BASE_URL = os.getenv("BASE_URL", "")

def get_full_url(relative_path: Optional[str]) -> Optional[str]:
    if not relative_path: return None
    
    # If it's already a full URL, check if it's a Supabase URL that needs signing
    if relative_path.startswith(("http://", "https://")):
        # If it's a Supabase storage URL, we might want to sign it
        # Example: https://abcxyz.supabase.co/storage/v1/object/public/product-images/123.webp
        if supabase and ".supabase.co/storage/v1/object/" in relative_path:
            parts = relative_path.split("/")
            filename = parts[-1]
            bucket = "profile-photos" if "profile-photos" in relative_path else "product-images"
            signed = get_signed_url(filename, bucket)
            return signed if signed else relative_path
        return relative_path
    
    # Use BASE_URL if provided, otherwise fall back to relative
    if BASE_URL:
        return f"{BASE_URL.rstrip('/')}/{relative_path.lstrip('/')}"
    return relative_path

def delete_image(url: str):
    try:
        fname = url.split("/uploads/product_images/")[-1]
        for p in [f"{UPLOAD_DIR}/{fname}", f"{UPLOAD_DIR}/thumbs/{fname}"]:
            if Path(p).exists():
                Path(p).unlink()
    except Exception as e:
        logger.warning(f"Delete image error: {e}")
