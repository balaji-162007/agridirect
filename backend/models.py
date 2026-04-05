"""
models.py  –  All SQLAlchemy ORM models
Python 3.13 / SQLite compatibility fixes:
  - JSON column default must use a callable (lambda) not a bare list/dict
    literal, otherwise SQLAlchemy shares the same list object across rows.
  - MySQL DateTime does NOT store timezone; use UTC everywhere in Python.
"""
import enum
from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Text, JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    farmer   = "farmer"
    customer = "customer"

class ProductType(str, enum.Enum):
    organic   = "organic"
    inorganic = "inorganic"

class ProductUnit(str, enum.Enum):
    kg    = "kg"
    unit  = "unit"
    bunch = "bunch"
    litre = "litre"

class OrderStatus(str, enum.Enum):
    placed           = "placed"
    confirmed        = "confirmed"
    out_for_delivery = "out_for_delivery"
    delivered        = "delivered"
    cancelled        = "cancelled"

class DeliveryMethod(str, enum.Enum):
    farmer_delivery = "farmer_delivery"
    local_partner   = "local_partner"
    farm_pickup     = "farm_pickup"

class PaymentMethod(str, enum.Enum):
    cod    = "cod"
    online = "online"

class PaymentStatus(str, enum.Enum):
    pending  = "pending"
    paid     = "paid"
    failed   = "failed"
    refunded = "refunded"


# ── User ──────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    phone      = Column(String(15), unique=True, nullable=False, index=True)
    name       = Column(String(120), nullable=False)
    role       = Column(String(20), default="customer", nullable=False)
    farm_name  = Column(String(120))
    location   = Column(String(200))
    bio           = Column(Text)
    profile_photo = Column(String(200))
    is_verified   = Column(Boolean, default=False)
    is_active     = Column(Boolean, default=True)

    # ── Delivery Settings ──
    latitude              = Column(Float)
    longitude             = Column(Float)
    max_delivery_distance = Column(Float, default=10.0) # km
    max_carrying_capacity = Column(Float, default=50.0) # kg
    base_delivery_fee     = Column(Float, default=20.0) # ₹
    cost_per_km           = Column(Float, default=5.0)  # ₹
    cost_per_kg           = Column(Float, default=2.0)  # ₹

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    products         = relationship("Product",  back_populates="farmer",   lazy="selectin")
    orders_placed    = relationship("Order", foreign_keys="Order.customer_id", back_populates="customer", lazy="selectin")
    orders_received  = relationship("Order", foreign_keys="Order.farmer_id",   back_populates="farmer",   lazy="selectin")
    reviews_given    = relationship("Review", foreign_keys="Review.customer_id", back_populates="customer", lazy="selectin")
    reviews_received = relationship("Review", foreign_keys="Review.farmer_id",   back_populates="farmer",   lazy="selectin")
    notifications    = relationship("Notification", back_populates="user", lazy="selectin")


# ── OTP ───────────────────────────────────────────────────────────────────────
class OTP(Base):
    __tablename__ = "otps"

    id         = Column(Integer, primary_key=True)
    phone      = Column(String(15), nullable=False, index=True)
    otp        = Column(String(6),  nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used       = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


# ── Product ───────────────────────────────────────────────────────────────────
class Product(Base):
    __tablename__ = "products"

    id               = Column(Integer, primary_key=True, index=True)
    farmer_id        = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name             = Column(String(200), nullable=False)
    name_ta          = Column(String(200))
    category         = Column(String(50),  nullable=False, index=True)
    product_type     = Column(String(20),  default="organic", nullable=False)
    price            = Column(Float, nullable=False)
    unit             = Column(String(20),  default="kg", nullable=False)
    quantity         = Column(Float, nullable=False, default=0)
    harvest_date     = Column(DateTime)
    description      = Column(Text)
    # FIX: Use lambda callables for mutable defaults to avoid shared-state bugs
    images           = Column(JSON, default=lambda: [])
    price_history    = Column(JSON, default=lambda: [])   # [{price, changed_at}]
    price_updated_at = Column(DateTime, server_default=func.now())
    market_price     = Column(Float)
    is_active        = Column(Boolean, default=True)
    created_at       = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, onupdate=func.now())

    farmer      = relationship("User",      back_populates="products",   lazy="selectin")
    order_items = relationship("OrderItem", back_populates="product",    lazy="selectin")
    reviews     = relationship("Review",    back_populates="product",    lazy="selectin")


# ── Delivery Slots ────────────────────────────────────────────────────────
class DeliverySlot(Base):
    __tablename__ = "delivery_slots"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(50), nullable=False) # e.g. "Morning"
    start_time = Column(String(10), nullable=False) # e.g. "07:00"
    end_time   = Column(String(10), nullable=False) # e.g. "10:00"
    max_orders = Column(Integer, default=50)        # capacity limit

    orders = relationship("Order", back_populates="slot")

# ── Order ─────────────────────────────────────────────────────────────────────
class Order(Base):
    __tablename__ = "orders"

    id                  = Column(Integer, primary_key=True, index=True)
    customer_id         = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farmer_id           = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status              = Column(String(30), default="placed", nullable=False)
    delivery_method     = Column(String(30), nullable=False)
    payment_method      = Column(String(20), nullable=False)
    payment_status      = Column(String(20), default="pending")
    subtotal            = Column(Float, nullable=False)
    delivery_charge     = Column(Float, default=0)
    total               = Column(Float, nullable=False)
    delivery_address    = Column(JSON, nullable=False)
    # ── Delivery Slots ──
    delivery_date       = Column(DateTime, index=True) # Usually just Date part matters
    slot_id             = Column(Integer, ForeignKey("delivery_slots.id"), nullable=True)
    
    # FIX: lambda default for mutable JSON list
    status_history      = Column(JSON, default=lambda: [])
    razorpay_order_id   = Column(String(100))
    razorpay_payment_id = Column(String(100))
    reviewed            = Column(Boolean, default=False)
    created_at          = Column(DateTime, server_default=func.now())
    updated_at          = Column(DateTime, onupdate=func.now())

    customer = relationship("User",      foreign_keys=[customer_id], back_populates="orders_placed",   lazy="selectin")
    farmer   = relationship("User",      foreign_keys=[farmer_id],   back_populates="orders_received", lazy="selectin")
    slot     = relationship("DeliverySlot", back_populates="orders", lazy="selectin")
    items    = relationship("OrderItem", back_populates="order",     cascade="all, delete-orphan",     lazy="selectin")
    reviews  = relationship("Review",    back_populates="order",     lazy="selectin")


# ── Order Item ────────────────────────────────────────────────────────────────
class OrderItem(Base):
    __tablename__ = "order_items"

    id           = Column(Integer, primary_key=True)
    order_id     = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    product_id   = Column(Integer, ForeignKey("products.id"), nullable=False)
    product_name = Column(String(200), nullable=False)
    qty          = Column(Float, nullable=False)
    price        = Column(Float, nullable=False)

    order   = relationship("Order",   back_populates="items")
    product = relationship("Product", back_populates="order_items")


# ── Review ────────────────────────────────────────────────────────────────────
class Review(Base):
    __tablename__ = "reviews"

    id              = Column(Integer, primary_key=True, index=True)
    order_id        = Column(Integer, ForeignKey("orders.id"),   nullable=True)
    product_id      = Column(Integer, ForeignKey("products.id"), nullable=True)
    farmer_id       = Column(Integer, ForeignKey("users.id"),    nullable=True)
    customer_id     = Column(Integer, ForeignKey("users.id"),    nullable=False)
    product_quality = Column(Integer, nullable=False)
    delivery_time   = Column(Integer, nullable=False)
    overall_service = Column(Integer, nullable=False)
    comment         = Column(Text)
    created_at      = Column(DateTime, server_default=func.now())

    order    = relationship("Order",   back_populates="reviews",           lazy="selectin")
    product  = relationship("Product", back_populates="reviews",           lazy="selectin")
    farmer   = relationship("User", foreign_keys=[farmer_id],   back_populates="reviews_received", lazy="selectin")
    customer = relationship("User", foreign_keys=[customer_id], back_populates="reviews_given",    lazy="selectin")


# ── Market Price ──────────────────────────────────────────────────────────────
class District(Base):
    __tablename__ = "districts"

    id      = Column(Integer, primary_key=True, index=True)
    name    = Column(String(100), unique=True, nullable=False)
    name_ta = Column(String(100))

    market_prices = relationship("MarketPrice", back_populates="district", lazy="selectin")

class MarketPrice(Base):
    __tablename__ = "market_prices"

    id          = Column(Integer, primary_key=True)
    district_id = Column(Integer, ForeignKey("districts.id"), index=True)
    name        = Column(String(100), nullable=False)
    name_ta     = Column(String(100))
    category    = Column(String(50), nullable=False, index=True)
    price       = Column(Float, nullable=False)
    change_pct  = Column(Float, default=0)
    market      = Column(String(100))
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())

    district = relationship("District", back_populates="market_prices", lazy="selectin")

# ── Notification ──────────────────────────────────────────────────────────────
class Notification(Base):
    __tablename__ = "notifications"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title      = Column(String(200), nullable=False)
    message    = Column(Text, nullable=False)
    type       = Column(String(50), default="info") 
    link       = Column(String(200))
    order_id   = Column(Integer, ForeignKey("orders.id"), nullable=True)
    is_read    = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="notifications")
