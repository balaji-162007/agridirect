# AgriDirect – Python 3.13 Fix Log

## Files Changed

### `requirements.txt`
| # | Change |
|---|--------|
| 1 | Pinned versions relaxed to `>=` so pip can resolve Python 3.13-compatible wheels |
| 2 | Added `aiosqlite>=0.20.0` for SQLite dev fallback (no MySQL needed locally) |
| 3 | Added `bcrypt>=4.1.0` explicitly — passlib 1.7.4 ships an old bcrypt that relies on the `crypt` stdlib module removed in Python 3.13 |
| 4 | Kept `aiomysql` and `pymysql` for production MySQL use |

---

### `database.py`
| # | Bug | Fix |
|---|-----|-----|
| 1 | **MySQL-only connection string** caused `ImportError` on dev machines without MySQL | Added SQLite fallback: `DATABASE_URL` now defaults to `sqlite+aiosqlite:///./agridirect.db` |
| 2 | **`pool_size` / `max_overflow` crash with SQLite** (`StaticPool` doesn't support these kwargs) | Engine creation is now branched: pool args only passed for non-SQLite URLs |

---

### `models.py`
| # | Bug | Fix |
|---|-----|-----|
| 1 | **Mutable default for JSON columns** — `default=list` and `default=dict` (bare callables) passed as `Column(JSON, default=list)` share the *same object* across rows in SQLAlchemy's unit-of-work when not using `server_default` | Changed to `default=lambda: []` and `default=lambda: {}` so each row gets a fresh instance |

---

### `utils.py`
| # | Bug | Fix |
|---|-----|-----|
| 1 | **`passlib` imports `crypt` at startup** — Python 3.13 removed the `crypt` stdlib module (PEP 594), causing `ModuleNotFoundError: No module named 'crypt'` | Added a minimal `crypt` stub injected into `sys.modules` *before* passlib is imported, satisfying passlib's import without enabling the broken module |
| 2 | **Old bcrypt bundled in passlib 1.7.4** uses deprecated `crypt` internals | Resolved by requiring `bcrypt>=4.1.0` in `requirements.txt`; passlib delegates to the installed bcrypt package |

---

### `main.py`
| # | Bug | Fix |
|---|-----|-----|
| 1 | **`@app.on_event("startup")` deprecated** in FastAPI ≥ 0.93 — raises `DeprecationWarning` and will be removed in a future release | Replaced with `@asynccontextmanager async def lifespan(app)` + `FastAPI(lifespan=lifespan)`. Shutdown now also disposes the engine cleanly |
| 2 | **`JSONResponse(500, {"detail": ...})`** — `JSONResponse.__init__` signature is `(content, status_code=200, ...)`. Passing `500` as the first positional arg set *content* to `500` and the response body was an integer, not a JSON dict | Fixed to `JSONResponse(content={...}, status_code=500)` using keyword args |
| 3 | **`hmac.new()` key encoding** — the secret was already a `str`; `.encode("utf-8")` added explicitly so the call is unambiguous and works identically on all Python versions | Both key and message now explicitly call `.encode("utf-8")` |
| 4 | **Bare `except: pass`** in harvest_date parsing | Changed to `except ValueError: pass` — avoids accidentally swallowing `KeyboardInterrupt` and `SystemExit` |

---

### `routers/orders.py`
| # | Bug | Fix |
|---|-----|-----|
| 1 | **`place_order` is called directly** from `main.py`'s `verify_payment` with explicit `db` and `customer` args, bypassing FastAPI's DI system. The old signature had no defaults for those params, so direct calls would fail with a `TypeError` | Added clear inline comment documenting the dual-call pattern; parameters retain `Depends()` for endpoint use and accept direct args for internal calls |

---

## Running Locally (Python 3.13)

```bash
# 1. Create & activate venv
python3.13 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install --upgrade pip 
pip install "setuptools<70" 
pip install "wheel" 
pip install -r requirements.txt

# 3. (Optional) copy and edit environment
cp .env .env.local
# Edit DATABASE_URL, SECRET_KEY, OTP_PROVIDER, RAZORPAY_* as needed

# 4. Run
uvicorn main:app --reload --port 8000
```

SQLite is used by default — no MySQL setup required for local development.

### Switching to MySQL
Set in `.env`:
```
DATABASE_URL=mysql+aiomysql://agriuser:agripass@localhost:3306/agridirect?charset=utf8mb4
```
