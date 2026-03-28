# 🌿 AgriDirect — Farmer-to-Customer Agricultural Marketplace

A full-stack web platform connecting farmers directly to customers, with Tamil/English bilingual support, OTP authentication, and real-time order tracking.

---

## 🚀 Quick Start Guide

### Step 1 — Install Python Dependencies

Open a terminal in the `backend` folder:

```bash
cd backend

# Create virtual environment (first time only)
python -m venv venv

# Activate it:
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install packages (first time only)
pip install -r requirements.txt
```

### Step 2 — Start the Backend Server

```bash
cd backend
venv\Scripts\activate
python -m uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     DB ready
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

> ✅ **Database is SQLite** — no MySQL setup needed. The `agridirect.db` file is created automatically.

### Step 3 — Start the Frontend Server

Open a **second terminal** (keep the backend running):

```bash
cd frontend
python -m http.server 5500
```

### Step 4 — Open the App

Open your browser: **http://localhost:5500**

---

## 🔑 How to Login / Register

This app uses **OTP (One-Time Password)** authentication. In development mode, the OTP is **NOT sent to your phone** — it's printed in the backend terminal.

### Steps:
1. Go to http://localhost:5500
2. Click **"Login"** → switch to **"Register"** tab
3. Select **Customer** or **Farmer**
4. Enter your name and a 10-digit mobile number
5. Click **Continue**
6. **Look at the backend terminal** — find this line:
   ```
   [MOCK OTP] +91XXXXXXXXXX → 847291
   ```
7. Type the 6-digit number (`847291` in this example) into the OTP boxes
8. Click **Verify** → You're logged in! 🎉

### After Login:
- **Farmers** → Redirected to the **Farmer Dashboard** (add products, manage orders)
- **Customers** → Redirected to the **Products page** (browse & buy)

---

## 📁 Project Structure

```
agridirect/
├── frontend/
│   ├── index.html              ← Landing page
│   ├── login.html              ← Login & Register (OTP)
│   ├── farmer-dashboard.html   ← Farmer dashboard
│   ├── customer-dashboard.html ← Customer dashboard
│   ├── products.html           ← Browse products
│   ├── cart.html               ← Shopping cart
│   ├── checkout.html           ← Checkout
│   ├── css/style.css           ← Stylesheet
│   └── js/
│       ├── language.js         ← EN / Tamil translations
│       ├── auth.js             ← OTP login, JWT session
│       ├── cart.js             ← Cart state & UI
│       ├── products.js         ← Product listing & filters
│       └── orders.js           ← Checkout & order tracking
│
└── backend/
    ├── main.py                 ← FastAPI app entry point
    ├── database.py             ← SQLite async connection
    ├── models.py               ← Database models (ORM)
    ├── utils.py                ← JWT, OTP, image helpers
    ├── requirements.txt        ← Python dependencies
    ├── .env                    ← Environment variables
    ├── agridirect.db           ← SQLite database (auto-created)
    ├── routers/
    │   ├── auth.py             ← OTP send/verify, register
    │   ├── products.py         ← Product listing & search
    │   ├── orders.py           ← Place & track orders
    │   ├── reviews.py          ← Submit & read reviews
    │   └── market_price.py     ← Market price data
    └── uploads/
        └── product_images/     ← Uploaded images (auto-created)
```

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to mobile |
| POST | `/api/auth/verify-otp` | Login with OTP |
| POST | `/api/auth/register` | Register new user |
| GET | `/api/products` | List products |
| GET | `/api/products/{id}` | Product detail |
| POST | `/api/farmer/products` | Add product (Farmer) |
| POST | `/api/orders` | Place order (Customer) |
| GET | `/api/orders/customer` | My order history |
| GET | `/api/market-prices` | Market prices |
| GET | `/api/health` | Health check |

**Full API docs:** http://localhost:8000/api/docs

---

## 🔧 Common Issues

### ❌ Backend terminal shows `KeyboardInterrupt` traceback
**This is normal!** It happens when you press Ctrl+C to stop the server. It's NOT an error.

### ❌ VS Code shows red import errors (Pyre2)
These are IDE warnings, not code errors. Fix by pressing `Ctrl+Shift+P` → **"Python: Select Interpreter"** → choose `backend\venv\Scripts\python.exe`

### ❌ OTP not arriving on phone
OTPs are **NOT sent to your phone** in dev mode. Look in the **backend terminal** for:
```
[MOCK OTP] +91XXXXXXXXXX → 123456
```

### ❌ Product images not showing
Make sure both servers are running (backend on 8000, frontend on 5500). Open the app via `http://localhost:5500` — NOT via `file://`.

### ❌ "Cannot reach server" error
Make sure the backend is running: `python -m uvicorn main:app --reload --port 8000`

---

## 🌍 Tamil Language Support

Click **EN** or **த** in the navbar to switch languages instantly.

---

## 🛡️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Python, FastAPI |
| Database | SQLite (via SQLAlchemy async) |
| Auth | JWT tokens + Mobile OTP |
| Images | Pillow (WebP compression) |
| i18n | English + Tamil |

---

*Made with ❤️ for Tamil Nadu Farmers*
