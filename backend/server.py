from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import logging
import uuid
import secrets
import bcrypt
import jwt
import stripe
import httpx
import re
import ipaddress
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from datetime import datetime, timezone, timedelta

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# ---------------------------------------------------------------------------
# Email (Emergent-managed Resend)
# ---------------------------------------------------------------------------
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Ceramica Incontro")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://ceramicaincontro.it")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY not set — skipping email send")
        return None
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    async with httpx.AsyncClient(timeout=30) as http:
        resp = await http.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                               headers={"X-Email-Key": EMAIL_KEY}, json=payload)
    resp.raise_for_status()
    return resp.json().get("id")


def _brand_wrap(inner: str) -> str:
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#F8F6F2;padding:32px 0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        'style="background:#ffffff;border:1px solid #E2DDD5">'
        '<tr><td style="background:#1C1917;padding:24px 32px">'
        '<div style="color:#F8F6F2;font-size:22px;letter-spacing:0.5px">Ceramica Incontro</div>'
        '<div style="color:#C05A3E;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:4px">fittile_ · dal 1976</div>'
        '</td></tr>'
        f'<tr><td style="padding:32px">{inner}</td></tr>'
        '<tr><td style="padding:20px 32px;border-top:1px solid #E2DDD5;color:#78716C;font-size:12px">'
        'Ceramica Incontro S.r.l. — Sassuolo (MO), Italia.<br>'
        'Non chiediamo mai password o dati della carta via email.'
        '</td></tr></table></td></tr></table>')


def _order_email_html(order: dict) -> str:
    rows = ""
    for it in order["items"]:
        rows += (f'<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#1C1917">'
                 f'{escape(str(it["name"]))} &times; {it["quantity"]}</td>'
                 f'<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;color:#1C1917">'
                 f'&euro; {it["price"] * it["quantity"]:.2f}</td></tr>')
    addr = order.get("shipping_address", {})
    ship = order.get("shipping_option", {})
    account_url = f"{FRONTEND_URL}/account"
    inner = (
        f'<h1 style="font-size:22px;color:#1C1917;margin:0 0 8px">Grazie per il tuo ordine!</h1>'
        f'<p style="color:#57534E;font-size:14px;line-height:1.6">Ciao {escape(str(order.get("customer", {}).get("name", "")))}, '
        f'abbiamo ricevuto il tuo ordine <strong>{escape(str(order["order_number"]))}</strong> e il pagamento &egrave; stato confermato.</p>'
        f'<table role="presentation" width="100%" style="margin:20px 0;font-size:14px">{rows}'
        f'<tr><td style="padding:8px 0;color:#78716C">Spedizione ({escape(str(ship.get("name", "")))})</td>'
        f'<td style="padding:8px 0;text-align:right;color:#78716C">&euro; {order.get("shipping_cost", 0):.2f}</td></tr>'
        f'<tr><td style="padding:10px 0;font-weight:bold;color:#1C1917">Totale</td>'
        f'<td style="padding:10px 0;text-align:right;font-weight:bold;color:#1C1917">&euro; {order.get("total", 0):.2f}</td></tr>'
        f'</table>'
        f'<p style="color:#57534E;font-size:14px;line-height:1.6"><strong>Spedizione a:</strong><br>'
        f'{escape(str(addr.get("line1", "")))}<br>{escape(str(addr.get("postal_code", "")))} '
        f'{escape(str(addr.get("city", "")))} {escape(str(addr.get("province", "")))}</p>'
        f'<p style="margin:24px 0"><a href="{account_url}" '
        f'style="background:#C05A3E;color:#fff;text-decoration:none;padding:12px 24px;font-size:14px;display:inline-block">'
        f'Vedi i tuoi ordini</a></p>')
    return _brand_wrap(inner)


def _shipping_email_html(order: dict) -> str:
    tracking = order.get("tracking", "")
    status = order.get("status", "")
    label = "spedito" if status == "shipped" else "consegnato"
    account_url = f"{FRONTEND_URL}/account"
    track_line = (f'<p style="color:#57534E;font-size:14px">Codice tracking: <strong>{escape(str(tracking))}</strong></p>'
                  if tracking else "")
    inner = (
        f'<h1 style="font-size:22px;color:#1C1917;margin:0 0 8px">Il tuo ordine &egrave; stato {label}</h1>'
        f'<p style="color:#57534E;font-size:14px;line-height:1.6">Ciao {escape(str(order.get("customer", {}).get("name", "")))}, '
        f'l&rsquo;ordine <strong>{escape(str(order["order_number"]))}</strong> risulta ora <strong>{label}</strong>.</p>'
        f'{track_line}'
        f'<p style="margin:24px 0"><a href="{account_url}" '
        f'style="background:#1C1917;color:#fff;text-decoration:none;padding:12px 24px;font-size:14px;display:inline-block">'
        f'Segui l&rsquo;ordine</a></p>')
    return _brand_wrap(inner)


async def _safe_send(to: str, subject: str, html: str):
    try:
        await send_email(to=to, subject=subject, html=html)
    except Exception as e:
        logger.error(f"Email non inviata a {to}: {e}")

app = FastAPI(title="Ceramica Incontro Shop API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ceramica")


def now_utc():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Shipping configuration (weight-based, multiple options)
# ---------------------------------------------------------------------------
SHIPPING_OPTIONS = [
    {"id": "standard", "name": "Corriere Standard", "rate_per_kg": 0.60, "min_cost": 12.0,
     "free_over": 900.0, "eta": "5-7 giorni lavorativi",
     "description": "Consegna al piano strada in tutta Italia."},
    {"id": "express", "name": "Corriere Espresso", "rate_per_kg": 1.10, "min_cost": 24.0,
     "free_over": None, "eta": "2-3 giorni lavorativi",
     "description": "Spedizione prioritaria con tracciamento."},
    {"id": "pallet", "name": "Spedizione su Bancale", "rate_per_kg": 0.42, "min_cost": 65.0,
     "free_over": None, "eta": "4-6 giorni lavorativi",
     "description": "Consigliata per grandi quantità (oltre 150 kg)."},
    {"id": "pickup", "name": "Ritiro in sede — Sassuolo", "rate_per_kg": 0.0, "min_cost": 0.0,
     "free_over": None, "eta": "Su appuntamento",
     "description": "Ritiro gratuito presso lo stabilimento di Sassuolo (MO)."},
]


def compute_shipping(weight_kg: float, subtotal: float, option_id: str) -> float:
    opt = next((o for o in SHIPPING_OPTIONS if o["id"] == option_id), None)
    if opt is None:
        raise HTTPException(400, "Metodo di spedizione non valido")
    if opt["free_over"] is not None and subtotal >= opt["free_over"]:
        return 0.0
    return round(max(opt["min_cost"], weight_kg * opt["rate_per_kg"]), 2)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class SessionInput(BaseModel):
    session_id: str


class CartItem(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=999)


class QuoteInput(BaseModel):
    items: List[CartItem]
    shipping_option_id: str


class CustomerInfo(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = ""


class ShippingAddress(BaseModel):
    line1: str
    city: str
    postal_code: str
    province: str = ""
    country: str = "IT"


class BillingInfo(BaseModel):
    vat_number: Optional[str] = ""
    codice_fiscale: Optional[str] = ""
    company: Optional[str] = ""


class CheckoutInput(BaseModel):
    items: List[CartItem]
    shipping_option_id: str
    customer: CustomerInfo
    shipping_address: ShippingAddress
    billing: Optional[BillingInfo] = None
    origin_url: str


class ProductInput(BaseModel):
    name: str
    collection: str
    description: str = ""
    price: float = Field(gt=0)
    format: str = ""
    finish: str = ""
    color: str = ""
    usage: str = ""
    weight_kg: float = Field(ge=0)
    coverage_sqm: float = Field(default=1.0, ge=0)
    stock: int = Field(default=100, ge=0)
    image: str = ""
    gallery: List[str] = []
    featured: bool = False


class OrderStatusInput(BaseModel):
    status: str
    tracking: Optional[str] = ""


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": now_utc() + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookie(response: Response, name: str, value: str, max_age: int):
    response.set_cookie(key=name, value=value, httponly=True, secure=True,
                        samesite="none", max_age=max_age, path="/")


def public_user(user: dict) -> dict:
    return {"id": user["id"], "email": user["email"], "name": user.get("name", ""),
            "role": user.get("role", "customer"), "picture": user.get("picture", "")}


async def resolve_user(request: Request) -> Optional[dict]:
    # 1) JWT access token cookie
    token = request.cookies.get("access_token")
    session_token = request.cookies.get("session_token")
    auth_header = request.headers.get("Authorization", "")
    bearer = auth_header[7:] if auth_header.startswith("Bearer ") else None

    # Try JWT (cookie or bearer)
    for candidate in [token, bearer]:
        if candidate:
            try:
                payload = jwt.decode(candidate, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                if payload.get("type") == "access":
                    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
                    if user:
                        return user
            except jwt.PyJWTError:
                pass

    # Try emergent session token (cookie or bearer)
    for candidate in [session_token, bearer]:
        if candidate:
            sess = await db.user_sessions.find_one({"session_token": candidate}, {"_id": 0})
            if sess:
                expires_at = sess["expires_at"]
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at)
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at > now_utc():
                    user = await db.users.find_one({"id": sess["user_id"]}, {"_id": 0})
                    if user:
                        return user
    return None


async def require_user(request: Request) -> dict:
    user = await resolve_user(request)
    if not user:
        raise HTTPException(401, "Non autenticato")
    return user


async def require_admin(request: Request) -> dict:
    user = await require_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Accesso riservato agli amministratori")
    return user


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email già registrata")
    user = {"id": str(uuid.uuid4()), "email": email, "name": data.name,
            "password_hash": hash_password(data.password), "role": "customer",
            "picture": "", "auth_provider": "password", "created_at": now_utc().isoformat()}
    await db.users.insert_one(user)
    token = create_access_token(user["id"], email)
    set_auth_cookie(response, "access_token", token, 604800)
    return {"user": public_user(user), "token": token}


@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response, request: Request):
    email = data.email.lower()
    ident = f"{request.client.host}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > now_utc():
            raise HTTPException(429, "Troppi tentativi. Riprova tra 15 minuti.")
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$inc": {"count": 1}, "$set": {"locked_until": (now_utc() + timedelta(minutes=15)).isoformat()}},
            upsert=True)
        raise HTTPException(401, "Email o password non validi")
    await db.login_attempts.delete_one({"identifier": ident})
    token = create_access_token(user["id"], email)
    set_auth_cookie(response, "access_token", token, 604800)
    return {"user": public_user(user), "token": token}


@api_router.post("/auth/session")
async def google_session(data: SessionInput, response: Response):
    async with httpx.AsyncClient() as http:
        r = await http.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": data.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Sessione non valida")
    info = r.json()
    email = info["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user = {"id": str(uuid.uuid4()), "email": email, "name": info.get("name", ""),
                "password_hash": "", "role": "customer", "picture": info.get("picture", ""),
                "auth_provider": "google", "created_at": now_utc().isoformat()}
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"email": email},
                                  {"$set": {"picture": info.get("picture", user.get("picture", ""))}})
    session_token = info["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user["id"], "session_token": session_token,
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(), "created_at": now_utc().isoformat()})
    set_auth_cookie(response, "session_token", session_token, 604800)
    return {"user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(require_user)):
    return public_user(user)


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    st = request.cookies.get("session_token")
    if st:
        await db.user_sessions.delete_one({"session_token": st})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
@api_router.get("/collections")
async def get_collections():
    cols = await db.products.distinct("collection")
    return sorted(cols)


@api_router.get("/products")
async def list_products(collection: Optional[str] = None, finish: Optional[str] = None,
                        format: Optional[str] = None, search: Optional[str] = None,
                        sort: str = "featured"):
    q = {}
    if collection and collection != "all":
        q["collection"] = collection
    if finish and finish != "all":
        q["finish"] = finish
    if format and format != "all":
        q["format"] = format
    if search:
        q["name"] = {"$regex": search, "$options": "i"}
    sort_map = {"price_asc": [("price", 1)], "price_desc": [("price", -1)],
                "name": [("name", 1)], "featured": [("featured", -1), ("name", 1)]}
    cursor = db.products.find(q, {"_id": 0}).sort(sort_map.get(sort, sort_map["featured"]))
    return await cursor.to_list(500)


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Prodotto non trovato")
    return p


# ---------------------------------------------------------------------------
# Admin products
# ---------------------------------------------------------------------------
@api_router.post("/admin/products")
async def create_product(data: ProductInput, admin: dict = Depends(require_admin)):
    p = data.model_dump()
    p["id"] = str(uuid.uuid4())
    p["created_at"] = now_utc().isoformat()
    await db.products.insert_one(p)
    p.pop("_id", None)
    return p


@api_router.put("/admin/products/{product_id}")
async def update_product(product_id: str, data: ProductInput, admin: dict = Depends(require_admin)):
    res = await db.products.update_one({"id": product_id}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Prodotto non trovato")
    return await db.products.find_one({"id": product_id}, {"_id": 0})


@api_router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(require_admin)):
    await db.products.delete_one({"id": product_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Shipping
# ---------------------------------------------------------------------------
@api_router.get("/shipping/options")
async def shipping_options():
    return SHIPPING_OPTIONS


async def _price_cart(items: List[CartItem]):
    subtotal = 0.0
    weight = 0.0
    lines = []
    for item in items:
        p = await db.products.find_one({"id": item.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(400, f"Prodotto {item.product_id} non trovato")
        line_total = p["price"] * item.quantity
        subtotal += line_total
        weight += p.get("weight_kg", 0) * item.quantity
        lines.append({"product_id": p["id"], "name": p["name"], "collection": p["collection"],
                      "price": p["price"], "quantity": item.quantity,
                      "weight_kg": p.get("weight_kg", 0), "image": p.get("image", "")})
    return round(subtotal, 2), round(weight, 2), lines


@api_router.post("/shipping/quote")
async def shipping_quote(data: QuoteInput):
    subtotal, weight, _ = await _price_cart(data.items)
    cost = compute_shipping(weight, subtotal, data.shipping_option_id)
    return {"subtotal": subtotal, "weight_kg": weight, "shipping_cost": cost,
            "total": round(subtotal + cost, 2)}


# ---------------------------------------------------------------------------
# Checkout / Payments
# ---------------------------------------------------------------------------
@api_router.post("/checkout")
async def create_checkout(data: CheckoutInput, request: Request):
    subtotal, weight, lines = await _price_cart(data.items)
    if not lines:
        raise HTTPException(400, "Carrello vuoto")
    shipping_cost = compute_shipping(weight, subtotal, data.shipping_option_id)
    shipping_opt = next(o for o in SHIPPING_OPTIONS if o["id"] == data.shipping_option_id)
    total = round(subtotal + shipping_cost, 2)

    user = await resolve_user(request)
    order_id = str(uuid.uuid4())
    order_number = "CI-" + datetime.now().strftime("%y%m%d") + "-" + order_id[:6].upper()

    stripe_lines = []
    for ln in lines:
        stripe_lines.append({
            "price_data": {"currency": "eur",
                           "product_data": {"name": f"{ln['collection']} — {ln['name']}"},
                           "unit_amount": int(round(ln["price"] * 100))},
            "quantity": ln["quantity"]})
    if shipping_cost > 0:
        stripe_lines.append({
            "price_data": {"currency": "eur",
                           "product_data": {"name": f"Spedizione — {shipping_opt['name']}"},
                           "unit_amount": int(round(shipping_cost * 100))},
            "quantity": 1})

    session = stripe.checkout.Session.create(
        line_items=stripe_lines,
        mode="payment",
        customer_email=data.customer.email,
        success_url=f"{data.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{data.origin_url}/payment/cancel",
        metadata={"order_id": order_id, "order_number": order_number})

    order = {
        "id": order_id, "order_number": order_number,
        "user_id": user["id"] if user else None,
        "customer": data.customer.model_dump(),
        "shipping_address": data.shipping_address.model_dump(),
        "billing": data.billing.model_dump() if data.billing else {},
        "items": lines, "subtotal": subtotal, "weight_kg": weight,
        "shipping_option": {"id": shipping_opt["id"], "name": shipping_opt["name"]},
        "shipping_cost": shipping_cost, "total": total,
        "status": "pending", "payment_status": "pending",
        "session_id": session.id, "tracking": "",
        "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()}
    await db.orders.insert_one(order)

    await db.payment_transactions.insert_one({
        "session_id": session.id, "order_id": order_id, "user_id": user["id"] if user else None,
        "amount": total, "currency": "eur", "status": "initiated", "payment_status": "pending",
        "created_at": now_utc(), "updated_at": now_utc()})

    return {"checkout_url": session.url, "session_id": session.id, "order_number": order_number}


async def _mark_paid(session_id: str, payment_intent=None):
    await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid",
                  "stripe_payment_intent_id": payment_intent, "updated_at": now_utc()}})
    res = await db.orders.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"payment_status": "paid", "status": "processing", "updated_at": now_utc().isoformat()}})
    if res.modified_count:
        order = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
        if order and not order.get("email_sent"):
            await db.orders.update_one({"id": order["id"]}, {"$set": {"email_sent": True}})
            await _safe_send(order["customer"]["email"],
                             f"Ordine confermato {order['order_number']} — Ceramica Incontro",
                             _order_email_html(order))


@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Transazione non trovata")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await _mark_paid(session_id, s.payment_intent)
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    order = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    return {"session_id": record["session_id"], "status": record["status"],
            "payment_status": record["payment_status"],
            "order_number": order["order_number"] if order else None}


@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Firma non valida")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await _mark_paid(obj["id"], obj.get("payment_intent"))
    elif t == "checkout.session.expired":
        await db.orders.update_one({"session_id": obj["id"]},
                                   {"$set": {"status": "cancelled", "payment_status": "expired"}})
    elif t == "charge.refunded":
        pi = obj.get("payment_intent")
        tx = await db.payment_transactions.find_one({"stripe_payment_intent_id": pi}, {"_id": 0})
        if tx and tx.get("order_id"):
            await db.payment_transactions.update_one(
                {"stripe_payment_intent_id": pi},
                {"$set": {"status": "refunded", "payment_status": "refunded", "updated_at": now_utc()}})
            await db.orders.update_one(
                {"id": tx["order_id"]},
                {"$set": {"status": "refunded", "payment_status": "refunded", "updated_at": now_utc().isoformat()}})
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------
@api_router.get("/orders")
async def my_orders(user: dict = Depends(require_user)):
    cursor = db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(require_user)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o or (o.get("user_id") != user["id"] and user.get("role") != "admin"):
        raise HTTPException(404, "Ordine non trovato")
    return o


@api_router.get("/admin/orders")
async def admin_orders(admin: dict = Depends(require_admin), status: Optional[str] = None):
    q = {}
    if status and status != "all":
        q["status"] = status
    cursor = db.orders.find(q, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(500)


@api_router.put("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, data: OrderStatusInput, admin: dict = Depends(require_admin)):
    res = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": data.status, "tracking": data.tracking, "updated_at": now_utc().isoformat()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Ordine non trovato")
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    orders = await db.orders.find({"payment_status": "paid"}, {"_id": 0}).to_list(1000)
    revenue = round(sum(o["total"] for o in orders), 2)
    total_orders = await db.orders.count_documents({})
    pending = await db.orders.count_documents({"status": "processing"})
    products = await db.products.count_documents({})
    return {"revenue": revenue, "paid_orders": len(orders), "total_orders": total_orders,
            "processing_orders": pending, "products": products}


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
SEED_PRODUCTS = [
    {"name": "SMUSSO Bianco 7cm", "collection": "SMUSSO", "price": 8.90, "format": "7x60 cm",
     "finish": "Matt", "color": "Bianco", "usage": "Battiscopa", "weight_kg": 0.9, "coverage_sqm": 0.6,
     "featured": True, "description": "Battiscopa innovativo alto solo 7 cm con moderno taglio a 30°. La linea SMUSSO reinventa il profilo classico con un'estetica minimale e contemporanea."},
    {"name": "SMUSSO Grigio Cemento 7cm", "collection": "SMUSSO", "price": 9.40, "format": "7x60 cm",
     "finish": "Matt", "color": "Grigio", "usage": "Battiscopa", "weight_kg": 0.95, "coverage_sqm": 0.6,
     "featured": True, "description": "Il taglio a 30° in tonalità cemento per ambienti dal carattere urbano e deciso."},
    {"name": "Battiscopa Classico 8x33", "collection": "Battiscopa", "price": 4.50, "format": "8x33 cm",
     "finish": "Lucido", "color": "Bianco", "usage": "Battiscopa", "weight_kg": 0.55, "coverage_sqm": 0.33,
     "featured": False, "description": "Il battiscopa in ceramica smaltata, resistente e facile da pulire. Formato compatto per ogni tipo di pavimento."},
    {"name": "Battiscopa Digitale 60cm Rovere", "collection": "Battiscopa", "price": 11.20, "format": "10x60 cm",
     "finish": "Matt", "color": "Legno", "usage": "Battiscopa", "weight_kg": 1.2, "coverage_sqm": 0.6,
     "featured": True, "description": "Stampa digitale ad altissima definizione effetto rovere, per abbinarsi perfettamente ai pavimenti in gres effetto legno."},
    {"name": "Moon Spots Pierre Brown", "collection": "Moon Spots", "price": 46.00, "format": "9x60 cm",
     "finish": "Strutturato", "color": "Marrone", "usage": "Rivestimento", "weight_kg": 1.4, "coverage_sqm": 0.54,
     "featured": True, "description": "Rivestimento in ceramica basato su moduli 9x60 cm con taglio a ritroso. Sfumature intense che evocano il fascino lunare. Prezzo al m²."},
    {"name": "Moon Spots Black", "collection": "Moon Spots", "price": 46.00, "format": "9x60 cm",
     "finish": "Strutturato", "color": "Nero", "usage": "Rivestimento", "weight_kg": 1.4, "coverage_sqm": 0.54,
     "featured": True, "description": "L'eleganza del nero profondo con superfici materiche. Ideale per pareti d'accento dal carattere deciso. Prezzo al m²."},
    {"name": "Paper Glass Aquamarine", "collection": "Paper Glass", "price": 38.50, "format": "30x60 cm",
     "finish": "Lucido", "color": "Acquamarina", "usage": "Rivestimento", "weight_kg": 1.6, "coverage_sqm": 0.72,
     "featured": True, "description": "Gres porcellanato ispirato al fascino del vetro: chiaroscuro, riflessi e colori intensi. Prezzo al m²."},
    {"name": "Paper Glass Ocher", "collection": "Paper Glass", "price": 38.50, "format": "30x60 cm",
     "finish": "Lucido", "color": "Ocra", "usage": "Rivestimento", "weight_kg": 1.6, "coverage_sqm": 0.72,
     "featured": False, "description": "Tonalità calda e avvolgente per dare personalità e carattere ad ogni ambiente. Prezzo al m²."},
    {"name": "Stony Grey Naturale", "collection": "Stony", "price": 42.00, "format": "60x60 cm",
     "finish": "Naturale", "color": "Grigio", "usage": "Pavimento", "weight_kg": 2.1, "coverage_sqm": 0.72,
     "featured": True, "description": "Gres porcellanato effetto pietra naturale. Texture moderne e dettagli di classe per un look urbano inconfondibile. Prezzo al m²."},
    {"name": "Stony Beige Antislip", "collection": "Stony", "price": 44.00, "format": "60x60 cm",
     "finish": "Antiscivolo R11", "color": "Beige", "usage": "Pavimento", "weight_kg": 2.2, "coverage_sqm": 0.72,
     "featured": False, "description": "Superficie antiscivolo R11 per esterni e ambienti umidi. Resistenza e sicurezza senza rinunciare all'estetica. Prezzo al m²."},
]

SEED_IMAGES = {
    "SMUSSO": "https://images.unsplash.com/photo-1489272889853-8093472c6f42?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
    "Battiscopa": "https://images.unsplash.com/photo-1710762797203-707c26233cee?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
    "Moon Spots": "https://images.unsplash.com/photo-1512119706465-5f60cf4d3e2d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
    "Paper Glass": "https://images.unsplash.com/photo-1673731535556-665e8b8041fe?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
    "Stony": "https://images.unsplash.com/photo-1763485955425-a61e722832ca?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
}


async def seed_admin():
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"id": str(uuid.uuid4()), "email": admin_email, "name": "Ceramica Incontro",
                                   "password_hash": hash_password(admin_password), "role": "admin",
                                   "picture": "", "auth_provider": "password", "created_at": now_utc().isoformat()})
    else:
        updates = {"role": "admin"}
        if not existing.get("password_hash") or not verify_password(admin_password, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_password)
        await db.users.update_one({"email": admin_email}, {"$set": updates})


async def seed_products():
    if await db.products.count_documents({}) > 0:
        return
    for p in SEED_PRODUCTS:
        doc = dict(p)
        doc["id"] = str(uuid.uuid4())
        doc["stock"] = 200
        doc["image"] = SEED_IMAGES.get(p["collection"], "")
        doc["gallery"] = []
        doc["created_at"] = now_utc().isoformat()
        await db.products.insert_one(doc)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("collection")
    await db.orders.create_index("user_id")
    await db.user_sessions.create_index("session_token")
    await seed_admin()
    await seed_products()
    logger.info("Ceramica Incontro shop ready.")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
