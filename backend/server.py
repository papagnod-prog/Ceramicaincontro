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
import asyncio
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
# Email (SMTP — hosting mailbox on ceramicaincontro.it)
# ---------------------------------------------------------------------------
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
EMAIL_FROM_ADDRESS = os.environ.get("EMAIL_FROM_ADDRESS", SMTP_USER)
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Ceramica Incontro")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://ceramicaincontro.it")

# Bank transfer details shown to customers who choose "bonifico bancario".
# Placeholder until the client supplies the real IBAN/account holder.
BANK_TRANSFER_IBAN = os.environ.get("BANK_TRANSFER_IBAN", "IT00 0000 0000 0000 0000 0000000")
BANK_TRANSFER_HOLDER = os.environ.get("BANK_TRANSFER_HOLDER", "Ceramica Incontro S.r.l.")
BANK_TRANSFER_BIC = os.environ.get("BANK_TRANSFER_BIC", "")

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


def _send_email_smtp_sync(*, to: str, subject: str, html: str) -> str:
    import smtplib
    import ssl
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.utils import formataddr, make_msgid

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS))
    msg["To"] = to
    if EMAIL_REPLY_TO:
        msg["Reply-To"] = EMAIL_REPLY_TO
    msg_id = make_msgid()
    msg["Message-ID"] = msg_id
    msg.attach(MIMEText(html, "html", "utf-8"))

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=20) as server:
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(EMAIL_FROM_ADDRESS, [to], msg.as_string())
    return msg_id


async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD):
        logger.warning("SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — skipping email send")
        return None
    _assert_safe_email(subject, html)
    return await asyncio.to_thread(_send_email_smtp_sync, to=to, subject=subject, html=html)


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
    payment_method = order.get("payment_method", "card")

    if payment_method == "card":
        intro = (f'abbiamo ricevuto il tuo ordine <strong>{escape(str(order["order_number"]))}</strong> '
                  'e il pagamento &egrave; stato confermato.')
        payment_note = ""
    elif payment_method == "bank_transfer":
        intro = (f'abbiamo ricevuto il tuo ordine <strong>{escape(str(order["order_number"]))}</strong>. '
                  'Per confermarlo, effettua il pagamento tramite bonifico bancario con i dati seguenti, '
                  'indicando il numero d&rsquo;ordine come causale.')
        payment_note = (
            f'<table role="presentation" width="100%" style="margin:16px 0;font-size:14px;background:#F8F6F2;padding:12px">'
            f'<tr><td style="padding:4px 0;color:#78716C">Beneficiario</td><td style="padding:4px 0;text-align:right;color:#1C1917">{escape(BANK_TRANSFER_HOLDER)}</td></tr>'
            f'<tr><td style="padding:4px 0;color:#78716C">IBAN</td><td style="padding:4px 0;text-align:right;color:#1C1917">{escape(BANK_TRANSFER_IBAN)}</td></tr>'
            + (f'<tr><td style="padding:4px 0;color:#78716C">BIC/SWIFT</td><td style="padding:4px 0;text-align:right;color:#1C1917">{escape(BANK_TRANSFER_BIC)}</td></tr>' if BANK_TRANSFER_BIC else "")
            + f'<tr><td style="padding:4px 0;color:#78716C">Causale</td><td style="padding:4px 0;text-align:right;color:#1C1917">{escape(str(order["order_number"]))}</td></tr>'
            f'</table>')
    else:  # cash on delivery
        intro = (f'abbiamo ricevuto il tuo ordine <strong>{escape(str(order["order_number"]))}</strong>. '
                  'Il pagamento avverr&agrave; in contanti alla consegna / ritiro.')
        payment_note = ""

    inner = (
        f'<h1 style="font-size:22px;color:#1C1917;margin:0 0 8px">Grazie per il tuo ordine!</h1>'
        f'<p style="color:#57534E;font-size:14px;line-height:1.6">Ciao {escape(str(order.get("customer", {}).get("name", "")))}, '
        f'{intro}</p>'
        f'{payment_note}'
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


def _sample_email_html(req: dict) -> str:
    rows = "".join(
        f'<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#1C1917">{escape(str(it["name"]))}</td></tr>'
        for it in req["items"]
    )
    addr = req.get("shipping_address", {})
    inner = (
        f'<h1 style="font-size:22px;color:#1C1917;margin:0 0 8px">Richiesta campioni ricevuta</h1>'
        f'<p style="color:#57534E;font-size:14px;line-height:1.6">Ciao {escape(str(req.get("customer", {}).get("name", "")))}, '
        f'abbiamo ricevuto la tua richiesta di campioni gratuiti <strong>{escape(str(req["request_number"]))}</strong>. '
        f'Ti contatteremo appena i campioni saranno pronti per la spedizione.</p>'
        f'<table role="presentation" width="100%" style="margin:20px 0;font-size:14px">{rows}</table>'
        f'<p style="color:#57534E;font-size:14px;line-height:1.6"><strong>Spedizione a:</strong><br>'
        f'{escape(str(addr.get("line1", "")))}<br>{escape(str(addr.get("postal_code", "")))} '
        f'{escape(str(addr.get("city", "")))} {escape(str(addr.get("province", "")))}</p>')
    return _brand_wrap(inner)


def _sample_status_email_html(req: dict) -> str:
    status = req.get("status", "")
    label = {"shipped": "spedita", "delivered": "consegnata"}.get(status, status)
    tracking = req.get("tracking", "")
    track_line = (f'<p style="color:#57534E;font-size:14px">Codice tracking: <strong>{escape(str(tracking))}</strong></p>'
                  if tracking else "")
    inner = (
        f'<h1 style="font-size:22px;color:#1C1917;margin:0 0 8px">La tua richiesta campioni &egrave; stata {label}</h1>'
        f'<p style="color:#57534E;font-size:14px;line-height:1.6">Ciao {escape(str(req.get("customer", {}).get("name", "")))}, '
        f'la richiesta <strong>{escape(str(req["request_number"]))}</strong> risulta ora <strong>{label}</strong>.</p>'
        f'{track_line}')
    return _brand_wrap(inner)


def _quote_email_html(q: dict) -> str:
    inner = (
        f'<h1 style="font-size:22px;color:#1C1917;margin:0 0 8px">Richiesta preventivo ricevuta</h1>'
        f'<p style="color:#57534E;font-size:14px;line-height:1.6">Ciao {escape(str(q.get("name", "")))}, '
        f'abbiamo ricevuto la tua richiesta di preventivo <strong>{escape(str(q["request_number"]))}</strong> per il progetto '
        f'&ldquo;{escape(str(q.get("project_type", "")))}&rdquo;. Il nostro team tecnico la valuter&agrave; e ti risponder&agrave; a breve '
        f'con una proposta dedicata.</p>'
        f'<table role="presentation" width="100%" style="margin:20px 0;font-size:14px">'
        f'<tr><td style="padding:6px 0;color:#78716C">Profilo</td><td style="padding:6px 0;text-align:right;color:#1C1917">{escape(str(q.get("profession", "")))}</td></tr>'
        f'<tr><td style="padding:6px 0;color:#78716C">Superficie stimata</td><td style="padding:6px 0;text-align:right;color:#1C1917">{escape(str(q.get("estimated_sqm", "")))} m&sup2;</td></tr>'
        f'<tr><td style="padding:6px 0;color:#78716C">Citt&agrave;</td><td style="padding:6px 0;text-align:right;color:#1C1917">{escape(str(q.get("city", "")))}</td></tr>'
        f'</table>')
    return _brand_wrap(inner)


def _admin_notify_email_html(title: str, rows: list) -> str:
    body = "".join(
        f'<tr><td style="padding:6px 0;color:#78716C">{escape(str(k))}</td>'
        f'<td style="padding:6px 0;text-align:right;color:#1C1917">{escape(str(v))}</td></tr>'
        for k, v in rows
    )
    inner = (f'<h1 style="font-size:20px;color:#1C1917;margin:0 0 12px">{escape(title)}</h1>'
             f'<table role="presentation" width="100%" style="font-size:14px">{body}</table>')
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


MAX_SAMPLE_ITEMS = 5


# ---------------------------------------------------------------------------
# Shipping configuration (weight-based, multiple options)
# ---------------------------------------------------------------------------
SHIPPING_OPTIONS = [
    {"id": "standard", "name": "Corriere Standard",
     "free_over": 900.0, "eta": "5-7 giorni lavorativi",
     "description": "Consegna al piano strada in tutta Italia."},
    {"id": "express", "name": "Corriere Espresso",
     "free_over": None, "eta": "2-3 giorni lavorativi",
     "description": "Spedizione prioritaria con tracciamento."},
    {"id": "pallet", "name": "Spedizione su Bancale",
     "free_over": None, "eta": "4-6 giorni lavorativi",
     "description": "Consigliata per grandi quantità (oltre 150 kg)."},
    {"id": "pickup", "name": "Ritiro in sede — Sassuolo",
     "free_over": None, "eta": "Su appuntamento",
     "description": "Ritiro gratuito presso lo stabilimento di Sassuolo (MO)."},
]


# ---------------------------------------------------------------------------
# Regional shipping rates (region x weight-bracket x collection), admin-managed
# ---------------------------------------------------------------------------
ITALIAN_REGIONS = [
    "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
    "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
    "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana",
    "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
]

DEFAULT_UNLOADING_SERVICE_PRICE = 0.0
UNLOADING_SERVICE_SETTINGS_ID = "unloading_service"


class WeightBracketInput(BaseModel):
    label: str
    min_kg: float = Field(ge=0)
    max_kg: Optional[float] = None  # None = "oltre" / senza limite superiore
    order: int = 0


class ShippingRateInput(BaseModel):
    shipping_option_id: str
    region: str
    collection: str
    weight_bracket_id: str
    price: float = Field(ge=0)


class UnloadingServiceInput(BaseModel):
    price: float = Field(ge=0)
    label: str = "Servizio di scarico (sponda idraulica + trans pallet)"


def _find_bracket_for_weight(brackets: List[dict], weight_kg: float) -> Optional[dict]:
    for b in sorted(brackets, key=lambda x: x["min_kg"]):
        if weight_kg >= b["min_kg"] and (b["max_kg"] is None or weight_kg <= b["max_kg"]):
            return b
    return None


async def compute_regional_shipping(shipping_option_id: str, region: str, lines: List[dict]):
    """Groups cart lines by collection, resolves a rate per collection group using
    region + weight-bracket + collection, and sums the results.
    Returns (total_cost, breakdown, all_available)."""
    brackets = await db.shipping_weight_brackets.find({}, {"_id": 0}).to_list(200)
    by_collection: dict = {}
    for ln in lines:
        c = ln.get("collection", "")
        by_collection.setdefault(c, 0.0)
        by_collection[c] += ln.get("weight_kg", 0) * ln.get("quantity", 1)

    breakdown = []
    total = 0.0
    all_available = True
    for collection, weight in by_collection.items():
        bracket = _find_bracket_for_weight(brackets, weight)
        entry = {"collection": collection, "weight_kg": round(weight, 2),
                  "bracket_id": bracket["id"] if bracket else None,
                  "bracket_label": bracket["label"] if bracket else None,
                  "available": False, "price": 0.0}
        if bracket:
            rate = await db.shipping_rates.find_one(
                {"shipping_option_id": shipping_option_id, "region": region,
                 "collection": collection, "weight_bracket_id": bracket["id"]}, {"_id": 0})
            if rate:
                entry["available"] = True
                entry["price"] = rate["price"]
                total += rate["price"]
        if not entry["available"]:
            all_available = False
        breakdown.append(entry)
    return round(total, 2), breakdown, all_available


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
    region: Optional[str] = None
    unloading_service: bool = False


class CustomerInfo(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = ""


class ShippingAddress(BaseModel):
    line1: str
    city: str
    postal_code: str
    province: str = ""
    region: str = ""
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
    unloading_service: bool = False
    payment_method: str = "cash"  # "cash" (contrassegno) or "bank_transfer" (bonifico). "card" reserved for future Stripe launch.


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


class SampleItem(BaseModel):
    product_id: str


class SampleRequestInput(BaseModel):
    items: List[SampleItem] = Field(min_length=1, max_length=MAX_SAMPLE_ITEMS)
    customer: CustomerInfo
    shipping_address: ShippingAddress
    note: Optional[str] = ""


class SampleStatusInput(BaseModel):
    status: str
    tracking: Optional[str] = ""


class QuoteRequestInput(BaseModel):
    name: str
    email: EmailStr
    phone: str = ""
    company: str = ""
    profession: str
    city: str = ""
    project_type: str
    estimated_sqm: Optional[float] = Field(default=None, ge=0)
    budget_range: Optional[str] = ""
    message: str = ""
    product_ids: List[str] = []


class QuoteStatusInput(BaseModel):
    status: str
    quoted_amount: Optional[float] = None
    admin_note: Optional[str] = ""


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


@api_router.get("/shipping/regions")
async def shipping_regions():
    return ITALIAN_REGIONS


@api_router.get("/shipping/weight-brackets")
async def shipping_weight_brackets_public():
    return await db.shipping_weight_brackets.find({}, {"_id": 0}).sort("min_kg", 1).to_list(200)


@api_router.get("/shipping/unloading-service")
async def shipping_unloading_service_public():
    doc = await db.shipping_settings.find_one({"id": UNLOADING_SERVICE_SETTINGS_ID}, {"_id": 0})
    if not doc:
        return {"price": DEFAULT_UNLOADING_SERVICE_PRICE,
                "label": "Servizio di scarico (sponda idraulica + trans pallet)"}
    return doc


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


async def _quote_shipping(shipping_option_id: str, region: Optional[str], unloading_service: bool,
                           subtotal: float, weight: float, lines: List[dict]):
    """Full shipping quote: region+weight+collection matrix, with fallback contact info
    when a rate is missing, plus optional unloading service surcharge (pallet)."""
    contact_email = EMAIL_REPLY_TO or os.environ.get("ADMIN_EMAIL", "")
    if not region:
        return {"available": False, "shipping_cost": 0.0, "breakdown": [],
                "contact_email": contact_email,
                "message": "Seleziona la tua regione per calcolare la spedizione."}

    cost, breakdown, available = await compute_regional_shipping(shipping_option_id, region, lines)

    unloading_price = 0.0
    if unloading_service:
        settings = await db.shipping_settings.find_one({"id": UNLOADING_SERVICE_SETTINGS_ID}, {"_id": 0})
        unloading_price = settings["price"] if settings else DEFAULT_UNLOADING_SERVICE_PRICE
        cost = round(cost + unloading_price, 2)

    opt = next((o for o in SHIPPING_OPTIONS if o["id"] == shipping_option_id), None)
    if opt and opt.get("free_over") is not None and subtotal >= opt["free_over"]:
        cost = round(unloading_price, 2)

    result = {"available": available, "shipping_cost": cost if available else 0.0,
              "breakdown": breakdown, "unloading_service_price": unloading_price}
    if not available:
        result["contact_email"] = contact_email
        result["message"] = ("Non abbiamo una tariffa di spedizione disponibile per questa "
                              "combinazione di regione, peso e categoria. Contatta il nostro "
                              "ufficio spedizioni: ti risponderemo con un preventivo dedicato.")
    return result


@api_router.post("/shipping/quote")
async def shipping_quote(data: QuoteInput):
    subtotal, weight, lines = await _price_cart(data.items)
    quote = await _quote_shipping(data.shipping_option_id, data.region, data.unloading_service,
                                   subtotal, weight, lines)
    cost = quote["shipping_cost"] if quote["available"] else 0.0
    return {"subtotal": subtotal, "weight_kg": weight, "shipping_cost": cost,
            "total": round(subtotal + cost, 2), **quote}


# ---------------------------------------------------------------------------
# Admin: shipping weight brackets, rates, unloading service
# ---------------------------------------------------------------------------
@api_router.get("/admin/shipping/weight-brackets")
async def admin_list_weight_brackets(admin: dict = Depends(require_admin)):
    return await db.shipping_weight_brackets.find({}, {"_id": 0}).sort("min_kg", 1).to_list(200)


@api_router.post("/admin/shipping/weight-brackets")
async def admin_create_weight_bracket(data: WeightBracketInput, admin: dict = Depends(require_admin)):
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    await db.shipping_weight_brackets.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/shipping/weight-brackets/{bracket_id}")
async def admin_update_weight_bracket(bracket_id: str, data: WeightBracketInput,
                                      admin: dict = Depends(require_admin)):
    res = await db.shipping_weight_brackets.update_one({"id": bracket_id}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Fascia di peso non trovata")
    return await db.shipping_weight_brackets.find_one({"id": bracket_id}, {"_id": 0})


@api_router.delete("/admin/shipping/weight-brackets/{bracket_id}")
async def admin_delete_weight_bracket(bracket_id: str, admin: dict = Depends(require_admin)):
    await db.shipping_weight_brackets.delete_one({"id": bracket_id})
    await db.shipping_rates.delete_many({"weight_bracket_id": bracket_id})
    return {"ok": True}


@api_router.get("/admin/shipping/rates")
async def admin_list_rates(admin: dict = Depends(require_admin)):
    return await db.shipping_rates.find({}, {"_id": 0}).to_list(5000)


@api_router.post("/admin/shipping/rates")
async def admin_upsert_rate(data: ShippingRateInput, admin: dict = Depends(require_admin)):
    key = {"shipping_option_id": data.shipping_option_id, "region": data.region,
           "collection": data.collection, "weight_bracket_id": data.weight_bracket_id}
    existing = await db.shipping_rates.find_one(key, {"_id": 0})
    if existing:
        await db.shipping_rates.update_one(key, {"$set": {"price": data.price}})
        existing["price"] = data.price
        return existing
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    await db.shipping_rates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/admin/shipping/rates/{rate_id}")
async def admin_delete_rate(rate_id: str, admin: dict = Depends(require_admin)):
    await db.shipping_rates.delete_one({"id": rate_id})
    return {"ok": True}


@api_router.get("/admin/shipping/unloading-service")
async def admin_get_unloading_service(admin: dict = Depends(require_admin)):
    doc = await db.shipping_settings.find_one({"id": UNLOADING_SERVICE_SETTINGS_ID}, {"_id": 0})
    return doc or {"id": UNLOADING_SERVICE_SETTINGS_ID, "price": DEFAULT_UNLOADING_SERVICE_PRICE,
                   "label": "Servizio di scarico (sponda idraulica + trans pallet)"}


@api_router.put("/admin/shipping/unloading-service")
async def admin_set_unloading_service(data: UnloadingServiceInput, admin: dict = Depends(require_admin)):
    doc = {"id": UNLOADING_SERVICE_SETTINGS_ID, "price": data.price, "label": data.label}
    await db.shipping_settings.update_one({"id": UNLOADING_SERVICE_SETTINGS_ID}, {"$set": doc}, upsert=True)
    return doc


@api_router.get("/admin/shipping/regions")
async def admin_list_regions(admin: dict = Depends(require_admin)):
    return ITALIAN_REGIONS


# ---------------------------------------------------------------------------
# Checkout / Payments
# ---------------------------------------------------------------------------
@api_router.post("/checkout")
async def create_checkout(data: CheckoutInput, request: Request):
    subtotal, weight, lines = await _price_cart(data.items)
    if not lines:
        raise HTTPException(400, "Carrello vuoto")
    quote = await _quote_shipping(data.shipping_option_id, data.shipping_address.region,
                                   data.unloading_service, subtotal, weight, lines)
    if not quote["available"]:
        raise HTTPException(400, "Spedizione non disponibile per questa regione/categoria/peso. "
                                  "Contatta il nostro ufficio spedizioni.")
    shipping_cost = quote["shipping_cost"]
    shipping_opt = next(o for o in SHIPPING_OPTIONS if o["id"] == data.shipping_option_id)
    total = round(subtotal + shipping_cost, 2)

    user = await resolve_user(request)
    order_id = str(uuid.uuid4())
    order_number = "CI-" + datetime.now().strftime("%y%m%d") + "-" + order_id[:6].upper()

    payment_method = data.payment_method if data.payment_method in ("cash", "bank_transfer", "card") else "cash"

    base_order = {
        "id": order_id, "order_number": order_number,
        "user_id": user["id"] if user else None,
        "customer": data.customer.model_dump(),
        "shipping_address": data.shipping_address.model_dump(),
        "billing": data.billing.model_dump() if data.billing else {},
        "items": lines, "subtotal": subtotal, "weight_kg": weight,
        "shipping_option": {"id": shipping_opt["id"], "name": shipping_opt["name"]},
        "shipping_cost": shipping_cost, "shipping_breakdown": quote["breakdown"],
        "unloading_service": data.unloading_service,
        "unloading_service_price": quote.get("unloading_service_price", 0.0),
        "total": total, "payment_method": payment_method,
        "tracking": "",
        "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()}

    if payment_method == "card":
        # Reserved for when a real Stripe key is configured. Falls through to
        # Stripe Checkout as before.
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

        order = {**base_order, "status": "pending", "payment_status": "pending",
                 "session_id": session.id}
        await db.orders.insert_one(order)
        await db.payment_transactions.insert_one({
            "session_id": session.id, "order_id": order_id, "user_id": user["id"] if user else None,
            "amount": total, "currency": "eur", "status": "initiated", "payment_status": "pending",
            "created_at": now_utc(), "updated_at": now_utc()})

        return {"checkout_url": session.url, "session_id": session.id, "order_number": order_number,
                "payment_method": payment_method}

    # Cash on delivery ("contrassegno") or bank transfer ("bonifico"): no Stripe involved.
    # Order is confirmed immediately; payment is settled offline / on delivery.
    order = {**base_order,
             "status": "processing" if payment_method == "cash" else "pending",
             "payment_status": "cod_pending" if payment_method == "cash" else "awaiting_transfer",
             "session_id": None}
    await db.orders.insert_one(order)

    if not order.get("email_sent"):
        await db.orders.update_one({"id": order_id}, {"$set": {"email_sent": True}})
        await _safe_send(data.customer.email,
                         f"Ordine confermato {order_number} — Ceramica Incontro",
                         _order_email_html(order))

    return {"checkout_url": f"{data.origin_url}/payment/confirmation?order={order_number}&method={payment_method}",
            "session_id": None, "order_number": order_number, "payment_method": payment_method}


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
    before = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Ordine non trovato")
    res = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": data.status, "tracking": data.tracking, "updated_at": now_utc().isoformat()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Ordine non trovato")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    # Notify the customer by email when the order ships or is delivered, once per status.
    sent_flag = f"{data.status}_email_sent"
    if data.status in ("shipped", "delivered") and before.get("status") != data.status and not order.get(sent_flag) \
            and order.get("customer", {}).get("email"):
        await db.orders.update_one({"id": order_id}, {"$set": {sent_flag: True}})
        label = "Spedito" if data.status == "shipped" else "Consegnato"
        await _safe_send(order["customer"]["email"],
                         f"Ordine {order['order_number']} — {label} — Ceramica Incontro",
                         _shipping_email_html(order))
        order[sent_flag] = True
    return order


# ---------------------------------------------------------------------------
# Richiesta Campioni (free tile samples before purchase)
# ---------------------------------------------------------------------------
SAMPLE_STATUS_OPTS = ["requested", "preparing", "shipped", "delivered"]


@api_router.post("/samples/request")
async def request_samples(data: SampleRequestInput, request: Request):
    seen = set()
    items = []
    for it in data.items:
        if it.product_id in seen:
            continue
        seen.add(it.product_id)
        p = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(400, f"Prodotto {it.product_id} non trovato")
        items.append({"product_id": p["id"], "name": p["name"], "collection": p["collection"], "image": p.get("image", "")})
    if not items:
        raise HTTPException(400, "Seleziona almeno un campione")
    if len(items) > MAX_SAMPLE_ITEMS:
        raise HTTPException(400, f"Puoi richiedere al massimo {MAX_SAMPLE_ITEMS} campioni gratuiti")

    user = await resolve_user(request)
    req_id = str(uuid.uuid4())
    req_number = "CS-" + datetime.now().strftime("%y%m%d") + "-" + req_id[:6].upper()
    req = {
        "id": req_id, "request_number": req_number,
        "user_id": user["id"] if user else None,
        "customer": data.customer.model_dump(),
        "shipping_address": data.shipping_address.model_dump(),
        "note": data.note or "", "items": items,
        "status": "requested", "tracking": "",
        "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()}
    await db.sample_requests.insert_one(req)

    await _safe_send(data.customer.email,
                     f"Richiesta campioni ricevuta {req_number} — Ceramica Incontro",
                     _sample_email_html(req))
    if os.environ.get("ADMIN_EMAIL"):
        await _safe_send(os.environ["ADMIN_EMAIL"],
                         f"Nuova richiesta campioni {req_number}",
                         _admin_notify_email_html("Nuova richiesta campioni", [
                             ("Numero", req_number), ("Cliente", data.customer.name),
                             ("Email", data.customer.email), ("Telefono", data.customer.phone or "-"),
                             ("Campioni", ", ".join(i["name"] for i in items)),
                         ]))
    return {"request_number": req_number, "id": req_id}


@api_router.get("/admin/samples")
async def admin_samples(admin: dict = Depends(require_admin), status: Optional[str] = None):
    q = {}
    if status and status != "all":
        q["status"] = status
    cursor = db.sample_requests.find(q, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(500)


@api_router.put("/admin/samples/{request_id}/status")
async def update_sample_status(request_id: str, data: SampleStatusInput, admin: dict = Depends(require_admin)):
    if data.status not in SAMPLE_STATUS_OPTS:
        raise HTTPException(400, "Stato non valido")
    before = await db.sample_requests.find_one({"id": request_id}, {"_id": 0})
    if not before:
        raise HTTPException(404, "Richiesta non trovata")
    await db.sample_requests.update_one(
        {"id": request_id},
        {"$set": {"status": data.status, "tracking": data.tracking, "updated_at": now_utc().isoformat()}})
    req = await db.sample_requests.find_one({"id": request_id}, {"_id": 0})
    sent_flag = f"{data.status}_email_sent"
    if data.status in ("shipped", "delivered") and before.get("status") != data.status and not req.get(sent_flag) \
            and req.get("customer", {}).get("email"):
        await db.sample_requests.update_one({"id": request_id}, {"$set": {sent_flag: True}})
        await _safe_send(req["customer"]["email"],
                         f"Richiesta campioni {req['request_number']} — aggiornamento",
                         _sample_status_email_html(req))
        req[sent_flag] = True
    return req


# ---------------------------------------------------------------------------
# Preventivi Progetto (custom quotes for architects/designers on large supplies)
# ---------------------------------------------------------------------------
QUOTE_STATUS_OPTS = ["new", "in_review", "quoted", "won", "lost"]


@api_router.post("/quotes/request")
async def request_quote(data: QuoteRequestInput):
    products = []
    for pid in data.product_ids[:20]:
        p = await db.products.find_one({"id": pid}, {"_id": 0})
        if p:
            products.append({"product_id": p["id"], "name": p["name"], "collection": p["collection"]})

    req_id = str(uuid.uuid4())
    req_number = "CQ-" + datetime.now().strftime("%y%m%d") + "-" + req_id[:6].upper()
    q = {
        "id": req_id, "request_number": req_number,
        "name": data.name, "email": data.email, "phone": data.phone, "company": data.company,
        "profession": data.profession, "city": data.city, "project_type": data.project_type,
        "estimated_sqm": data.estimated_sqm, "budget_range": data.budget_range or "",
        "message": data.message, "products": products,
        "status": "new", "quoted_amount": None, "admin_note": "",
        "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()}
    await db.quote_requests.insert_one(q)

    await _safe_send(data.email,
                     f"Richiesta preventivo ricevuta {req_number} — Ceramica Incontro",
                     _quote_email_html(q))
    if os.environ.get("ADMIN_EMAIL"):
        await _safe_send(os.environ["ADMIN_EMAIL"],
                         f"Nuova richiesta preventivo {req_number} ({data.profession})",
                         _admin_notify_email_html("Nuova richiesta preventivo progetto", [
                             ("Numero", req_number), ("Nome", data.name), ("Email", data.email),
                             ("Telefono", data.phone or "-"), ("Azienda", data.company or "-"),
                             ("Profilo", data.profession), ("Progetto", data.project_type),
                             ("Città", data.city or "-"),
                             ("Superficie stimata", f"{data.estimated_sqm} m²" if data.estimated_sqm else "-"),
                         ]))
    return {"request_number": req_number, "id": req_id}


@api_router.get("/admin/quotes")
async def admin_quotes(admin: dict = Depends(require_admin), status: Optional[str] = None):
    q = {}
    if status and status != "all":
        q["status"] = status
    cursor = db.quote_requests.find(q, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(500)


@api_router.put("/admin/quotes/{quote_id}/status")
async def update_quote_status(quote_id: str, data: QuoteStatusInput, admin: dict = Depends(require_admin)):
    if data.status not in QUOTE_STATUS_OPTS:
        raise HTTPException(400, "Stato non valido")
    res = await db.quote_requests.update_one(
        {"id": quote_id},
        {"$set": {"status": data.status, "quoted_amount": data.quoted_amount,
                  "admin_note": data.admin_note or "", "updated_at": now_utc().isoformat()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Richiesta non trovata")
    return await db.quote_requests.find_one({"id": quote_id}, {"_id": 0})


@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    # Confirmed = paid by card, or a placed cash/bank_transfer order (settled offline/on delivery).
    confirmed_filter = {"payment_status": {"$in": ["paid", "cod_pending", "awaiting_transfer"]}}
    orders = await db.orders.find(confirmed_filter, {"_id": 0}).to_list(1000)
    revenue = round(sum(o["total"] for o in orders), 2)
    total_orders = await db.orders.count_documents({})
    pending = await db.orders.count_documents({"status": "processing"})
    products = await db.products.count_documents({})
    sample_requests = await db.sample_requests.count_documents({})
    quote_requests = await db.quote_requests.count_documents({"status": {"$in": ["new", "in_review"]}})
    return {"revenue": revenue, "paid_orders": len(orders), "total_orders": total_orders,
            "processing_orders": pending, "products": products,
            "sample_requests": sample_requests, "open_quote_requests": quote_requests}


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
    await db.sample_requests.create_index("user_id")
    await db.quote_requests.create_index("status")
    await db.shipping_rates.create_index(
        [("shipping_option_id", 1), ("region", 1), ("collection", 1), ("weight_bracket_id", 1)],
        unique=True)
    await db.shipping_weight_brackets.create_index("min_kg")
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
