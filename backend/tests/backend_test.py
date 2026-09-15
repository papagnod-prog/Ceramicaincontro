"""Ceramica Incontro Shop – backend API tests"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to frontend env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "papagno.d@gmail.com"
ADMIN_PASSWORD = "CeramicaIncontro2026!"


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_session(api):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return s


# ---------- Collections & Products ----------
class TestCatalog:
    def test_collections(self, api):
        r = api.get(f"{BASE_URL}/api/collections")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0

    def test_list_products(self, api):
        r = api.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        prods = r.json()
        assert isinstance(prods, list) and len(prods) >= 5
        p = prods[0]
        for key in ("id", "name", "price", "collection", "weight_kg"):
            assert key in p
        assert "_id" not in p

    def test_filter_by_collection(self, api):
        cols = api.get(f"{BASE_URL}/api/collections").json()
        r = api.get(f"{BASE_URL}/api/products", params={"collection": cols[0]})
        assert r.status_code == 200
        assert all(p["collection"] == cols[0] for p in r.json())

    def test_search(self, api):
        r = api.get(f"{BASE_URL}/api/products", params={"search": "SMUSSO"})
        assert r.status_code == 200
        assert all("smusso" in p["name"].lower() for p in r.json())

    def test_sort_price_asc(self, api):
        r = api.get(f"{BASE_URL}/api/products", params={"sort": "price_asc"})
        prices = [p["price"] for p in r.json()]
        assert prices == sorted(prices)

    def test_get_product_detail(self, api):
        pid = api.get(f"{BASE_URL}/api/products").json()[0]["id"]
        r = api.get(f"{BASE_URL}/api/products/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_get_product_not_found(self, api):
        r = api.get(f"{BASE_URL}/api/products/nonexistent-id")
        assert r.status_code == 404


# ---------- Shipping ----------
class TestShipping:
    def test_shipping_options(self, api):
        r = api.get(f"{BASE_URL}/api/shipping/options")
        assert r.status_code == 200
        opts = r.json()
        ids = {o["id"] for o in opts}
        assert {"standard", "express", "pallet", "pickup"}.issubset(ids)

    def test_quote_standard(self, api):
        p = api.get(f"{BASE_URL}/api/products").json()[0]
        r = api.post(f"{BASE_URL}/api/shipping/quote", json={
            "items": [{"product_id": p["id"], "quantity": 2}],
            "shipping_option_id": "standard"})
        assert r.status_code == 200
        data = r.json()
        assert data["subtotal"] == round(p["price"] * 2, 2)
        assert data["shipping_cost"] >= 0
        assert data["total"] == round(data["subtotal"] + data["shipping_cost"], 2)

    def test_quote_pickup_free(self, api):
        p = api.get(f"{BASE_URL}/api/products").json()[0]
        r = api.post(f"{BASE_URL}/api/shipping/quote", json={
            "items": [{"product_id": p["id"], "quantity": 1}],
            "shipping_option_id": "pickup"})
        assert r.status_code == 200
        assert r.json()["shipping_cost"] == 0.0

    def test_quote_invalid_option(self, api):
        p = api.get(f"{BASE_URL}/api/products").json()[0]
        r = api.post(f"{BASE_URL}/api/shipping/quote", json={
            "items": [{"product_id": p["id"], "quantity": 1}],
            "shipping_option_id": "invalid"})
        assert r.status_code == 400


# ---------- Auth ----------
class TestAuth:
    def test_register_and_me(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{BASE_URL}/api/auth/register",
                   json={"email": email, "password": "Password123", "name": "Test User"})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["email"] == email
        # cookie should now be set – call /me
        me = s.get(f"{BASE_URL}/api/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == email
        # logout
        lo = s.post(f"{BASE_URL}/api/auth/logout")
        assert lo.status_code == 200

    def test_register_duplicate(self, api):
        email = f"TEST_dup_{uuid.uuid4().hex[:8]}@example.com"
        payload = {"email": email, "password": "Password123", "name": "Dup"}
        r1 = api.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert r1.status_code == 200
        r2 = api.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert r2.status_code == 400

    def test_login_invalid(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": "nope@nope.com", "password": "wrongwrong"})
        assert r.status_code == 401

    def test_admin_login(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"


# ---------- Admin ----------
class TestAdmin:
    def test_stats(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 200
        data = r.json()
        for k in ("revenue", "paid_orders", "total_orders", "processing_orders", "products"):
            assert k in data

    def test_stats_forbidden_for_guest(self, api):
        r = api.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 401

    def test_product_crud(self, admin_session):
        payload = {"name": "TEST_Prod", "collection": "TEST_C", "price": 12.5,
                   "weight_kg": 1.0, "coverage_sqm": 0.5}
        r = admin_session.post(f"{BASE_URL}/api/admin/products", json=payload)
        assert r.status_code == 200, r.text
        prod = r.json()
        pid = prod["id"]
        assert prod["name"] == "TEST_Prod"
        # GET verifies persistence
        g = admin_session.get(f"{BASE_URL}/api/products/{pid}")
        assert g.status_code == 200
        # UPDATE
        payload["price"] = 20.0
        u = admin_session.put(f"{BASE_URL}/api/admin/products/{pid}", json=payload)
        assert u.status_code == 200
        assert u.json()["price"] == 20.0
        # DELETE
        d = admin_session.delete(f"{BASE_URL}/api/admin/products/{pid}")
        assert d.status_code == 200
        g2 = admin_session.get(f"{BASE_URL}/api/products/{pid}")
        assert g2.status_code == 404

    def test_admin_orders_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/orders")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Checkout ----------
class TestCheckout:
    def test_guest_checkout_creates_stripe_session(self, api):
        p = api.get(f"{BASE_URL}/api/products").json()[0]
        payload = {
            "items": [{"product_id": p["id"], "quantity": 1}],
            "shipping_option_id": "standard",
            "customer": {"email": "TEST_guest@example.com", "name": "Guest", "phone": ""},
            "shipping_address": {"line1": "Via Roma 1", "city": "Sassuolo",
                                 "postal_code": "41049", "province": "MO", "country": "IT"},
            "origin_url": BASE_URL,
        }
        r = api.post(f"{BASE_URL}/api/checkout", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "checkout_url" in data
        assert "stripe.com" in data["checkout_url"]
        assert data["order_number"].startswith("CI-")
        sid = data["session_id"]
        # payment status should exist
        st = api.get(f"{BASE_URL}/api/payments/status/{sid}")
        assert st.status_code == 200
        assert st.json()["payment_status"] == "pending"

    def test_checkout_admin_user(self, admin_session):
        p = admin_session.get(f"{BASE_URL}/api/products").json()[0]
        payload = {
            "items": [{"product_id": p["id"], "quantity": 3}],
            "shipping_option_id": "express",
            "customer": {"email": ADMIN_EMAIL, "name": "Admin", "phone": ""},
            "shipping_address": {"line1": "Via A 1", "city": "Modena",
                                 "postal_code": "41100", "province": "MO", "country": "IT"},
            "origin_url": BASE_URL,
        }
        r = admin_session.post(f"{BASE_URL}/api/checkout", json=payload)
        assert r.status_code == 200, r.text
        # authenticated /orders should now include the new one
        orders = admin_session.get(f"{BASE_URL}/api/orders")
        assert orders.status_code == 200
        assert any(o["order_number"] == r.json()["order_number"] for o in orders.json())


# ---------- Orders ----------
class TestOrders:
    def test_orders_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/orders")
        assert r.status_code == 401

    def test_update_order_status(self, admin_session):
        # ensure at least one order exists
        orders = admin_session.get(f"{BASE_URL}/api/admin/orders").json()
        if not orders:
            pytest.skip("no orders to update")
        oid = orders[0]["id"]
        r = admin_session.put(f"{BASE_URL}/api/admin/orders/{oid}/status",
                              json={"status": "processing", "tracking": "TRACK123"})
        assert r.status_code == 200
        assert r.json()["tracking"] == "TRACK123"
