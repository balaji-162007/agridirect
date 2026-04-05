"""
main.py  –  AgriDirect FastAPI application
Python 3.13 fixes applied:
  1. Replaced deprecated @app.on_event("startup") with lifespan context manager.
  2. Fixed JSONResponse(500, {...}) → JSONResponse(content={...}, status_code=500).
  3. hmac.new() byte-safety ensured for RZP_SECRET.
"""
import os, time, logging, hashlib, hmac, asyncio
from dotenv import load_dotenv
load_dotenv()
import cloudinary
import cloudinary.uploader
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, Request, Depends, HTTPException, UploadFile, File, Form, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from twilio.rest import Client 
from database import engine, Base, get_db
from models import User, Product, Order, Review, OrderItem, MarketPrice, Notification, District
from utils import (get_current_user, get_current_farmer, get_current_customer,
                   save_image, delete_image, create_token, get_full_url,
                   get_signed_url, upload_to_cloudinary, delete_from_cloudinary)
from routers import auth, products, orders, reviews, market_price, notifications, delivery

DATABASE_URL = os.getenv("DATABASE_URL")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Ensure required directories exist at startup
Path("uploads/product_images/thumbs").mkdir(parents=True, exist_ok=True)
Path("uploads/profile_photos").mkdir(parents=True, exist_ok=True)

# FIX: Filter out expected Windows/Uvicorn shutdown errors from logging
class ShutdownFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage()
        # Suppress common shutdown noise and tracebacks on Windows
        suppress_keywords = [
            "CancelledError", "RuntimeError", "Event loop is closed",
            "BrokenPipeError", "ConnectionResetError", "Stopping worker",
            "Waiting for background tasks", "All workers stopped",
            "Task was destroyed but it is pending", "Heartbeat failed"
        ]
        if any(kw in msg for kw in suppress_keywords):
            return False
            
        if record.exc_info:
            exc_type, exc_val, _ = record.exc_info
            if exc_type and issubclass(exc_type, (asyncio.CancelledError, RuntimeError, KeyboardInterrupt, ConnectionResetError, BrokenPipeError)):
                return False
            # Also check the string representation of the exception value
            exc_str = str(exc_val)
            if any(kw in exc_str for kw in suppress_keywords):
                return False
        return True

# Apply filter to Uvicorn loggers, the main app logger, and the root logger
for name in [None, "uvicorn", "uvicorn.error", "uvicorn.access", "uvicorn.asgi", "fastapi"]:
    logging.getLogger(name).addFilter(ShutdownFilter())
logger.addFilter(ShutdownFilter())

# Suppress all logs during actual interpreter exit to avoid Windows-specific tracebacks
import sys
def final_cleanup():
    logging.disable(logging.CRITICAL)
import atexit
atexit.register(final_cleanup)

RZP_KEY    = os.getenv("RAZORPAY_KEY_ID",    "rzp_test_placeholder")
RZP_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "placeholder_secret")

# ── Cloudinary Config is now handled in utils.py ─────────────────────────────


# FIX 1: Replace deprecated @app.on_event("startup") with lifespan context manager
# (FastAPI 0.93+ deprecates on_event; lifespan is the recommended approach)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database connected and tables created")
        
        # FIX: Sync sequences for PostgreSQL to prevent UniqueViolation on ID columns
        # This happens when manual inserts or imports cause sequences to fall behind.
        if "postgresql" in str(engine.url):
            from sqlalchemy import text
            with engine.connect() as conn:
                # Find all tables with serial/identity columns and reset their sequences
                tables = ["users", "products", "orders", "order_items", "reviews", "notifications", "districts", "market_prices"]
                for table in tables:
                    try:
                        conn.execute(text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 1)) FROM {table}"))
                        conn.commit()
                    except Exception as seq_err:
                        print(f"⚠️ Sequence sync skipped for {table}: {seq_err}")
                print("✅ PostgreSQL sequences synchronized")
                
    except Exception as e:
        print("❌ DB ERROR:", e)

    yield
    # ── Shutdown ─────────────────────────────────────────────────────────────
    try:
        engine.dispose()
    except Exception:
        pass


app = FastAPI(
    title="AgriDirect API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,  # FIX 1: pass lifespan instead of on_event
)

# 🔐 Twilio Configuration 
account_sid = os.getenv("TWILIO_ACCOUNT_SID") 
auth_token = os.getenv("TWILIO_AUTH_TOKEN") 
verify_sid = os.getenv("TWILIO_VERIFY_SERVICE_SID") 

if account_sid and auth_token:
    client = Client(account_sid, auth_token)
else:
    client = None
    logger.warning("Twilio credentials missing. SMS features will be disabled.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://agridirect-mu.vercel.app",
        "https://agridirect.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_origin_regex=r"https://agridirect.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
    ],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def log_req(request: Request, call_next):
    t = time.time()
    try:
        res = await call_next(request)
        # Suppress logging during shutdown/reload
        if not request.scope.get("type") == "http": return res
        logger.info(f"{request.method} {request.url.path} {res.status_code} {(time.time()-t)*1000:.0f}ms")
        return res
    except (asyncio.CancelledError, RuntimeError, KeyboardInterrupt, GeneratorExit):
        # Gracefully handle shutdown during a request without logging
        return JSONResponse(status_code=503, content={"detail": "Shutting down"})
    except Exception as e:
        # Don't log common shutdown errors as full tracebacks
        if any(kw in str(e) for kw in ["loop is closed", "CancelledError"]):
            return JSONResponse(status_code=503, content={"detail": "Shutting down"})
        logger.error(f"Error processing {request.method} {request.url.path}: {e}")
        
        # FIX: Ensure error responses include CORS headers so they aren't blocked by browsers
        response = JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error", "error": str(e)}
        )
        origin = request.headers.get("origin")
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response


app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.post("/api/upload")
async def upload_single(file: UploadFile = File(...)):
    """Upload a single image to Cloudinary"""
    try:
        content = await file.read()
        res = await upload_to_cloudinary(content)
        return {
            "success": True,
            "url": res.get("secure_url"),
            "publicId": res.get("public_id"),
            "width": res.get("width"),
            "height": res.get("height")
        }
    except Exception as e:
        logger.error(f"Single upload error: {e}")
        return JSONResponse(status_code=500, content={"error": "Image upload failed", "details": str(e)})

@app.post("/api/upload/multiple")
async def upload_multiple(files: List[UploadFile] = File(...)):
    """Upload multiple images (up to 5) to Cloudinary"""
    if len(files) > 5:
        return JSONResponse(status_code=400, content={"error": "Maximum 5 files allowed"})
    
    try:
        upload_tasks = []
        for file in files:
            content = await file.read()
            upload_tasks.append(upload_to_cloudinary(content))
        
        results = await asyncio.gather(*upload_tasks)
        return {
            "success": True,
            "urls": [r.get("secure_url") for r in results],
            "publicIds": [r.get("public_id") for r in results]
        }
    except Exception as e:
        logger.error(f"Multiple upload error: {e}")
        return JSONResponse(status_code=500, content={"error": "Image upload failed", "details": str(e)})

@app.delete("/api/upload/{public_id:path}")
async def delete_image_cloudinary(public_id: str):
    """Delete an image from Cloudinary by its public_id"""
    try:
        await delete_from_cloudinary(public_id)
        return {"success": True}
    except Exception as e:
        logger.error(f"Delete image error: {e}")
        return JSONResponse(status_code=500, content={"error": "Delete failed", "details": str(e)})

@app.post("/api/upload-product-image")
async def upload_image_endpoint(file: UploadFile = File(...)):
    """Standalone endpoint for testing product image uploads to Cloudinary"""
    try:
        # Use Cloudinary directly as requested for the "New Way"
        result = cloudinary.uploader.upload(file.file, folder="agridirect/products")
        image_url = result["secure_url"]
        return {"image_url": image_url}
    except Exception as e:
        logger.error(f"Upload endpoint error: {e}")
        raise HTTPException(500, str(e))

@app.get("/")
def home():
    return {"message": "Backend is running"}

# Standard auth and data routers
app.include_router(auth.router,         prefix="/api/auth",          tags=["Auth"])
app.include_router(products.router,     prefix="/api/products",      tags=["Products"])
app.include_router(orders.router,       prefix="/api/orders",        tags=["Orders"])
app.include_router(reviews.router,      prefix="/api/reviews",       tags=["Reviews"])
app.include_router(market_price.router, prefix="/api/market-prices", tags=["Market Prices"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])

# ── Farmers directory ─────────────────────────────────────────────────────────
farmers_router = APIRouter()

@farmers_router.get("")
def list_farmers(db: Session = Depends(get_db)):
    # Consolidate farmer listing with ratings and product counts
    res = db.execute(
        select(User)
        .where(User.role == "farmer", User.is_active == True)
        .options(selectinload(User.products), selectinload(User.reviews_received))
        .order_by(User.name)
    )
    farmers = []
    for u in res.scalars().all():
        reviews = u.reviews_received or []
        avg_r = sum(r.overall_service for r in reviews) / len(reviews) if reviews else None
        
        # Use signed URL for farmer profile photo
        profile_photo = u.profile_photo
        if profile_photo:
            profile_photo = get_signed_url(profile_photo, "profile")
            
        farmers.append({
            "id": u.id, "name": u.name, "farm_name": u.farm_name,
            "location": u.location, "bio": u.bio,
            "profile_photo": profile_photo,
            "is_verified": u.is_verified,
            "products_count": len([p for p in (u.products or []) if p.is_active]),
            "avg_rating": round(avg_r, 1) if avg_r else None,
            "reviews_count": len(reviews)
        })
    return {"farmers": farmers}

@farmers_router.get("/{fid}")
def get_farmer(fid: int, db: Session = Depends(get_db)):
    u = db.get(User, fid)
    if not u or u.role != "farmer":
        raise HTTPException(404, "Farmer not found")
    
    # Use signed URL for profile photo
    profile_photo = u.profile_photo
    if profile_photo:
        profile_photo = get_signed_url(profile_photo, "profile")
        
    return {"farmer": {
        "id": u.id, "name": u.name, "farm_name": u.farm_name,
        "location": u.location, "bio": u.bio,
        "profile_photo": profile_photo,
        "is_verified": u.is_verified,
        "latitude": u.latitude, "longitude": u.longitude,
        "max_delivery_distance": u.max_delivery_distance,
        "max_carrying_capacity": u.max_carrying_capacity,
        "base_delivery_fee": u.base_delivery_fee,
        "cost_per_km": u.cost_per_km,
        "cost_per_kg": u.cost_per_kg
    }}

app.include_router(farmers_router, prefix="/api/farmers", tags=["Farmers"])

# ── Farmer dashboard routes ──────────────────────────────────────────────────
farmer_router = APIRouter()


def _pd(p):
    # Use signed URLs for product images
    images = []
    if p.images:
        images = [get_signed_url(img, "product") for img in p.images]
        
    return {
        "id": p.id, "name": p.name, "name_ta": p.name_ta,
        "category": p.category, "product_type": p.product_type,
        "price": p.price, "unit": p.unit, "quantity": p.quantity,
        "harvest_date": p.harvest_date.isoformat() if hasattr(p.harvest_date, 'isoformat') else str(p.harvest_date) if p.harvest_date else None,
        "description": p.description, 
        "images": images,
        "price_history": p.price_history or [],
        "price_updated_at": p.price_updated_at.isoformat() if hasattr(p.price_updated_at, 'isoformat') else str(p.price_updated_at) if p.price_updated_at else None,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if hasattr(p.created_at, 'isoformat') else str(p.created_at) if p.created_at else None,
    }


def _match_market_price(db: Session, product_name: str, location: Optional[str] = None):
    """Look up the closest market price for a product by name (case-insensitive).
    If location is provided, it tries to find the price in that district first."""
    clean_p = product_name.strip().lower()
    
    # Try to find the district first if location is provided
    district_id = None
    if location:
        clean_loc = location.strip().lower()
        d_res = db.execute(select(District).where(District.name.ilike(f"%{clean_loc}%")))
        d = d_res.scalar_one_or_none()
        if d:
            district_id = d.id

    # Query market prices
    q = select(MarketPrice)
    if district_id:
        # Prioritize local district
        local_q = q.where(MarketPrice.district_id == district_id)
        res = db.execute(local_q)
        for mp in res.scalars().all():
            mp_name = mp.name.lower()
            if mp_name in clean_p or clean_p in mp_name:
                return mp.price
    
    # Fallback to any district if no local match or no district found
    res = db.execute(q)
    for mp in res.scalars().all():
        mp_name = mp.name.lower()
        if mp_name in clean_p or clean_p in mp_name:
            return mp.price
            
    return None


@farmer_router.get("/stats")
def farmer_stats(db: Session = Depends(get_db), farmer: User = Depends(get_current_farmer)):
    np  = db.execute(select(func.count(Product.id)).where(Product.farmer_id == farmer.id, Product.is_active == True)).scalar_one()
    # Number of orders COMPLETED (status = delivered)
    no  = db.execute(select(func.count(Order.id)).where(Order.farmer_id == farmer.id, Order.status == "delivered")).scalar_one()
    rev = db.execute(select(func.sum(Order.total)).where(Order.farmer_id == farmer.id, Order.status == "delivered")).scalar_one() or 0
    ar  = db.execute(select(func.avg(Review.overall_service)).where(Review.farmer_id == farmer.id)).scalar_one_or_none()
    return {"products": np, "completed_orders": no, "revenue": round(rev, 2), "avg_rating": round(ar, 2) if ar else None}


@farmer_router.get("/products")
def farmer_products(db: Session = Depends(get_db), farmer: User = Depends(get_current_farmer)):
    res = db.execute(select(Product).where(Product.farmer_id == farmer.id).order_by(Product.created_at.desc()))
    return {"products": [_pd(p) for p in res.scalars().all()]}


@farmer_router.get("/orders")
def get_farmer_orders(limit: int = 100, db: Session = Depends(get_db), farmer: User = Depends(get_current_farmer)):
    # Re-use logic from orders router but mount under /api/farmer/orders
    from routers.orders import _o
    res = db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.customer), selectinload(Order.farmer))
        .where(Order.farmer_id == farmer.id)
        .order_by(Order.created_at.desc())
        .limit(limit)
    )
    return {"orders": [_o(o) for o in res.scalars().all()]}


@farmer_router.post("/products", status_code=201)
async def add_product(
    name: str = Form(...), name_ta: Optional[str] = Form(None),
    category: str = Form(...), product_type: str = Form("organic"),
    price: float = Form(...), unit: str = Form("kg"),
    quantity: float = Form(...), harvest_date: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db), farmer: User = Depends(get_current_farmer),
):
    if price <= 0:
        raise HTTPException(400, "Price must be positive")
    if len(images) > 5:
        raise HTTPException(400, "Max 5 images")
    
    urls = []
    for f in images:
        if f.filename:
            url = await save_image(f, farmer.id)
            urls.append(url)

    hd = None
    if harvest_date:
        try:
            hd = datetime.fromisoformat(harvest_date)
        except ValueError:
            pass
    p = Product(
        farmer_id=farmer.id, name=name.strip(), name_ta=name_ta,
        category=category.lower(), product_type=product_type,
        price=price, unit=unit, quantity=quantity, harvest_date=hd,
        description=description, images=urls,
        price_history=[{"price": price, "changed_at": datetime.now(timezone.utc).isoformat()}],
        price_updated_at=datetime.now(timezone.utc),
    )
    # Auto-match market price for price transparency
    mp = _match_market_price(db, name, farmer.location)
    if mp is not None:
        p.market_price = mp
    db.add(p)
    db.flush()
    return {"message": "Product added", "product": _pd(p)}


@farmer_router.put("/products/{pid}")
async def update_product(
    pid: int,
    name: Optional[str] = Form(None), name_ta: Optional[str] = Form(None),
    category: Optional[str] = Form(None), product_type: Optional[str] = Form(None),
    price: Optional[float] = Form(None), unit: Optional[str] = Form(None),
    quantity: Optional[float] = Form(None), harvest_date: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    keep_images: Optional[str] = Form(None), # JSON string of existing image URLs to keep
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db), farmer: User = Depends(get_current_farmer),
):
    res = db.execute(select(Product).where(Product.id == pid, Product.farmer_id == farmer.id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Not found")
    if name:          p.name         = name.strip()
    if name_ta:       p.name_ta      = name_ta
    if category:      p.category     = category.lower()
    if product_type:  p.product_type = product_type
    if unit:          p.unit         = unit
    if quantity is not None: p.quantity = quantity
    if description:   p.description  = description
    if price is not None and price != p.price:
        hist = p.price_history or []
        hist.append({"price": price, "changed_at": datetime.now(timezone.utc).isoformat()})
        p.price = price
        p.price_history = hist
        p.price_updated_at = datetime.now(timezone.utc)
    if harvest_date:
        try:
            p.harvest_date = datetime.fromisoformat(harvest_date)
        except ValueError:
            pass

    # Handle images: keep specified ones and add new ones
    current_images = p.images or []
    updated_images = []
    
    if keep_images:
        import json
        try:
            to_keep = json.loads(keep_images)
            
            def get_filename(path):
                if not path: return ""
                # Handle full URLs (Cloudinary, Supabase, Local)
                return path.split("/")[-1].split("?")[0]

            to_keep_filenames = [get_filename(url) for url in to_keep]
            
            # Only keep images whose filename matches what the frontend sent
            updated_images = [img for img in current_images if get_filename(img) in to_keep_filenames]
            
            # Delete images that were removed from the list
            removed = [img for img in current_images if get_filename(img) not in to_keep_filenames]
            for img in removed:
                delete_image(img)
        except Exception as e:
            logger.error(f"Error processing keep_images: {e}")
            updated_images = current_images

    new_urls = []
    for f in images:
        if f.filename:
            url = await save_image(f, farmer.id)
            new_urls.append(url)

    p.images = (updated_images + new_urls)[:5]
    # Auto-match market price if name changed or market_price not set
    if name or not p.market_price:
        mp = _match_market_price(db, p.name, farmer.location)
        if mp is not None:
            p.market_price = mp
    db.flush()
    return {"message": "Updated", "product": _pd(p)}


@farmer_router.delete("/products/{pid}")
def delete_product(pid: int, db: Session = Depends(get_db), farmer: User = Depends(get_current_farmer)):
    res = db.execute(select(Product).where(Product.id == pid, Product.farmer_id == farmer.id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Not found")
    p.is_active = False
    for url in (p.images or []):
        delete_image(url)
    db.flush()
    return {"message": "Deleted"}


@farmer_router.get("/reviews")
def farmer_reviews(db: Session = Depends(get_db), farmer: User = Depends(get_current_farmer)):
    res = db.execute(
        select(Review)
        .options(selectinload(Review.customer), selectinload(Review.product))
        .where(Review.farmer_id == farmer.id)
        .order_by(Review.created_at.desc())
    )
    rv = res.scalars().all()
    return {"reviews": [
        {
            "id": r.id, "customer_name": r.customer.name,
            "product_name": r.product.name if r.product else "—",
            "product_quality": r.product_quality, "delivery_time": r.delivery_time,
            "overall_service": r.overall_service, "comment": r.comment,
            "created_at": r.created_at.isoformat(),
        }
        for r in rv
    ]}


app.include_router(farmer_router, prefix="/api/farmer", tags=["Farmer"])


# ── Payments ─────────────────────────────────────────────────────────────────
payments_router = APIRouter()


class CreatePayReq(BaseModel):
    amount: float
    currency: str = "INR"


@payments_router.post("/create-order")
def create_payment(body: CreatePayReq, user: User = Depends(get_current_user)):
    try:
        import razorpay
        client = razorpay.Client(auth=(RZP_KEY, RZP_SECRET))
        rz = client.order.create({
            "amount": int(body.amount * 100),
            "currency": body.currency,
            "receipt": f"agri_{user.id}",
        })
        return {"razorpay_order_id": rz["id"], "amount": rz["amount"],
                "currency": rz["currency"], "key_id": RZP_KEY}
    except Exception as e:
        raise HTTPException(500, f"Payment failed: {e}")


@payments_router.post("/verify")
def verify_payment(
    body: dict,
    db: Session = Depends(get_db),
    customer: User = Depends(get_current_customer),
):
    data = body
    # FIX 3: Ensure RZP_SECRET is encoded to bytes before passing to hmac.new
    sig = hmac.new(
        RZP_SECRET.encode("utf-8"),
        f"{data.get('razorpay_order_id', '')}|{data.get('razorpay_payment_id', '')}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, data.get("razorpay_signature", "")):
        raise HTTPException(400, "Invalid payment signature")
    from routers.orders import PlaceOrderReq, AddrIn, ItemIn, place_order
    payload = PlaceOrderReq(
        items=[ItemIn(**i) for i in data["items"]],
        delivery_address=AddrIn(**data["delivery_address"]),
        delivery_method=data["delivery_method"],
        payment_method=data["payment_method"],
        subtotal=data["subtotal"],
        delivery_charge=data.get("delivery_charge", 0),
        total=data["total"],
        razorpay_order_id=data.get("razorpay_order_id"),
        razorpay_payment_id=data.get("razorpay_payment_id"),
    )
    return place_order(payload, db, customer)


app.include_router(payments_router, prefix="/api/payments", tags=["Payments"])
app.include_router(delivery.router, prefix="/api") 


# ── Aliases ───────────────────────────────────────────────────────────────────
@app.get("/api/customer/reviews", tags=["Reviews"])
def customer_reviews(db: Session = Depends(get_db), customer: User = Depends(get_current_customer)):
    return reviews.my_reviews(db=db, customer=customer)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AgriDirect", "version": "1.0.0"}


# FIX 2: JSONResponse positional-arg order was wrong.
# Old:  JSONResponse(500, {"detail": "..."})  → 500 treated as *content*
# Fixed: keyword args with correct names
@app.exception_handler(Exception)
def err_handler(request: Request, exc: Exception):
    if isinstance(exc, (asyncio.CancelledError, RuntimeError, KeyboardInterrupt)):
        return JSONResponse(content={"detail": "Shutting down"}, status_code=503)
    logger.error(f"Unhandled: {exc}", exc_info=True)
    return JSONResponse(content={"detail": "Internal server error"}, status_code=500)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
