"""
utils.py  –  JWT, OTP, image compression, helpers
Python 3.13 fixes:
  - passlib's CryptContext with bcrypt now requires bcrypt>=4.1.0.
    passlib 1.7.4 tries to import the removed `crypt` stdlib module on 3.13;
    we work around this by patching the bcrypt handler before first use.
"""
import os, random, string, uuid, io, logging, asyncio
import cloudinary
import cloudinary.uploader
from datetime import datetime, timedelta, timezone
from typing import Optional
from pathlib import Path

# ── Cloudinary Config ───────────────────────────────────────────────────────
# Consolidate Cloudinary config with hardcoded fallbacks for Render deployment
CLOUDINARY_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "doncplk8x")
CLOUDINARY_KEY  = os.getenv("CLOUDINARY_API_KEY",  "372657558314881")
CLOUDINARY_SEC  = os.getenv("CLOUDINARY_API_SECRET", "2SmROsQ28ndaX2GNcO_5BNlM18c")

cloudinary.config(
    cloud_name=CLOUDINARY_NAME,
    api_key=CLOUDINARY_KEY,
    api_secret=CLOUDINARY_SEC,
    secure=True
)

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

def get_public_image_url(filename: str, bucket: str):
    supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_url or not filename: return ""
    fname = filename.split("/")[-1]
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{fname}"

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
TWILIO_VERIFY_SID  = os.getenv("TWILIO_VERIFY_SERVICE_SID", "")
MSG91_KEY          = os.getenv("MSG91_API_KEY", "")
MSG91_SENDER       = os.getenv("MSG91_SENDER_ID", "AGRIDR")
MSG91_TEMPLATE     = os.getenv("MSG91_TEMPLATE_ID", "")
OTP_EXPIRE_MINUTES = 10

from twilio.rest import Client 
twilio_client = None
if TWILIO_SID and TWILIO_TOKEN:
    twilio_client = Client(TWILIO_SID, TWILIO_TOKEN)
else:
    logger.warning("Twilio credentials missing. SMS features will be disabled.")

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
    """Send OTP to phone number using configured provider (mock | twilio | msg91)"""
    # Debug print as requested by user
    print(f"DEBUG: Attempting to send OTP to {phone}")

    # Twilio Verify API logic provided by user
    if TWILIO_VERIFY_SID and twilio_client:
        try:
            verification = twilio_client.verify.v2.services(TWILIO_VERIFY_SID).verifications.create(
                to=phone,
                channel="sms"
            )
            print("OTP sent:", verification.status)
            # Twilio Verify handles OTP generation, so the `otp` parameter is ignored here
            # But the existing system uses database storage for verification.
            # This is a transitional state.
            return verification.status in ("pending", "approved")
        except Exception as e:
            print("ERROR:", str(e))
            logger.error(f"Twilio Verify Error: {e}")
            return False

    msg = f"Your AgriDirect OTP is {otp}. Valid {OTP_EXPIRE_MINUTES} mins. Do not share."
    if OTP_PROVIDER == "twilio" and TWILIO_SID:
        return _twilio(phone, msg)
    if OTP_PROVIDER == "msg91" and MSG91_KEY:
        return _msg91(phone, otp)
    
    # Mock fallback
    print(f"[MOCK OTP] {phone} → {otp}")
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


def verify_twilio_otp(phone: str, otp: str) -> bool:
    """Verify OTP using Twilio Verify API"""
    if not (TWILIO_VERIFY_SID and twilio_client):
        return False
    try:
        check = twilio_client.verify.v2.services(TWILIO_VERIFY_SID).verification_checks.create(
            to=phone, code=otp
        )
        return check.status == "approved"
    except Exception as e:
        logger.error(f"Twilio Verify Check Error: {e}")
        return False


# ── Image upload & compress ──────────────────────────────────────────────────
async def upload_to_cloudinary(file_content: bytes, folder: str = "agridirect/products") -> dict:
    """Helper to upload to Cloudinary and return full result dict with secure URL"""
    try:
        # Run synchronous upload in a separate thread to avoid blocking the event loop
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            file_content,
            folder=folder,
            resource_type="image",
            transformation=[
                {"width": 800, "height": 800, "crop": "limit"},
                {"quality": "auto:good"},
                {"fetch_format": "auto"}
            ]
        )
        return result
    except Exception as e:
        logger.error(f"Cloudinary upload error: {e}")
        raise HTTPException(500, f"Cloudinary upload failed: {e}")

async def delete_from_cloudinary(public_id: str):
    """Delete an image from Cloudinary by its public_id"""
    try:
        await asyncio.to_thread(cloudinary.uploader.destroy, public_id)
    except Exception as e:
        logger.error(f"Cloudinary delete error: {e}")
        raise HTTPException(500, f"Cloudinary delete failed: {e}")

async def upload_supabase(content: bytes, filename: str, content_type: str, bucket: str = "product-images") -> str:
    """Helper to upload to Supabase Storage and return public URL"""
    if not supabase:
        raise HTTPException(500, "Supabase storage not configured.")
    try:
        # Match user's preferred upload structure
        supabase.storage.from_(bucket).upload(
            path=filename,
            file=content,
            file_options={"content-type": content_type, "upsert": "true"}
        )
        # Ensure we return the correct public URL for display
        return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{filename}"
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
    content = out.getvalue()
    
    # Priority 1: Cloudinary
    if CLOUDINARY_NAME:
        res = await upload_to_cloudinary(content, folder="agridirect/profiles")
        return res.get("secure_url")
    
    # Priority 2: Supabase if available
    if supabase:
        return await upload_supabase(content, fname, "image/webp", bucket="profile-photos")

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
    
    out = io.BytesIO()
    img.save(out, format="WEBP", quality=JPEG_QUALITY, optimize=True)
    content = out.getvalue()

    # Priority 1: Cloudinary
    if CLOUDINARY_NAME:
        res = await upload_to_cloudinary(content, folder="agridirect/products")
        return res.get("secure_url")

    # Priority 2: Supabase if available
    if supabase:
        return await upload_supabase(content, fname, "image/webp", bucket="product-images")

    img.save(f"{UPLOAD_DIR}/{fname}", format="WEBP", quality=JPEG_QUALITY, optimize=True)

    thumb = img.copy()
    thumb.thumbnail((400, 400), Image.LANCZOS)
    thumb.save(f"{UPLOAD_DIR}/thumbs/{fname}", format="WEBP", quality=72, optimize=True)

    logger.info(f"Saved image: {fname}")
    return f"/uploads/product_images/{fname}"

def get_signed_url(filename: str, image_type: str):
    if not filename: return ""
    if filename.startswith(("http://", "https://")): return filename
    
    # If Supabase is configured, use it
    if os.getenv("SUPABASE_URL"):
        bucket = "product-images" if image_type == "product" else "profile-photos"
        return get_public_image_url(filename, bucket)
    
    # Otherwise, fallback to local URL
    # Ensure the path is correct for local development
    if image_type == "product":
        if not filename.startswith("/uploads/product_images/"):
            filename = f"/uploads/product_images/{filename.lstrip('/')}"
    else:
        if not filename.startswith("/uploads/profile_photos/"):
            filename = f"/uploads/profile_photos/{filename.lstrip('/')}"
            
    return get_full_url(filename)

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

def get_full_url(relative_path: Optional[str]) -> Optional[str]:
    if not relative_path: return None
    if relative_path.startswith(("http://", "https://")): return relative_path
    
    base = BASE_URL.rstrip("/")
    path = relative_path.lstrip("/")
    return f"{base}/{path}"

def delete_image(url: str):
    try:
        fname = url.split("/uploads/product_images/")[-1]
        for p in [f"{UPLOAD_DIR}/{fname}", f"{UPLOAD_DIR}/thumbs/{fname}"]:
            if Path(p).exists():
                Path(p).unlink()
    except Exception as e:
        logger.warning(f"Delete image error: {e}")
