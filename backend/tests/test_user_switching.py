"""Comprehensive End-to-End User Switching & Data Isolation Test Suite.
Verifies:
1. Registration & Login of new accounts.
2. /api/auth/me returns the exact authenticated user.
3. Logout revokes token version and invalidates subsequent requests.
4. User A (Buyer) -> Logout -> User B (Seller) completely switches identity.
5. Buyer/Seller Data Isolation (BOLA/IDOR protection):
   - Buyer cannot modify seller's listing.
   - Non-participant cannot view private deals or messages.
   - Non-participant cannot access dispute workspace.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_auth_registration_and_login():
    # 1. Register a new user
    signup_payload = {
        "name": "Priya Sharma",
        "email": "priya.test@accord.demo",
        "password": "SecurePass2026!",
    }
    r_signup = client.post("/api/auth/signup", json=signup_payload)
    assert r_signup.status_code in (201, 409)

    # 2. Login with registered user
    r_login = client.post(
        "/api/auth/login",
        json={"email": "priya.test@accord.demo", "password": "SecurePass2026!"},
    )
    assert r_login.status_code == 200
    token = r_login.json()["access_token"]
    assert token is not None

    # 3. Verify /me
    r_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_me.status_code == 200
    assert r_me.json()["email"] == "priya.test@accord.demo"
    assert r_me.json()["name"] == "Priya Sharma"


def test_complete_user_switching_and_logout_cleanup():
    # 1. Login as Buyer
    r_buyer = client.post(
        "/api/auth/login",
        json={"email": "buyer@accord.demo", "password": "AccordDemo2026!"},
    )
    assert r_buyer.status_code == 200
    buyer_token = r_buyer.json()["access_token"]

    r_me_b = client.get("/api/auth/me", headers={"Authorization": f"Bearer {buyer_token}"})
    assert r_me_b.status_code == 200
    assert r_me_b.json()["email"] == "buyer@accord.demo"
    buyer_id = r_me_b.json()["id"]

    # 2. Logout Buyer
    r_logout = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {buyer_token}", "x-accord-csrf": "1"},
    )
    assert r_logout.status_code == 200

    # 3. Verify Buyer token is now dead (token_version incremented)
    r_dead = client.get("/api/auth/me", headers={"Authorization": f"Bearer {buyer_token}"})
    assert r_dead.status_code == 401

    # 4. Login as Seller
    r_seller = client.post(
        "/api/auth/login",
        json={"email": "seller@accord.demo", "password": "AccordDemo2026!"},
    )
    assert r_seller.status_code == 200
    seller_token = r_seller.json()["access_token"]

    r_me_s = client.get("/api/auth/me", headers={"Authorization": f"Bearer {seller_token}"})
    assert r_me_s.status_code == 200
    assert r_me_s.json()["email"] == "seller@accord.demo"
    assert r_me_s.json()["id"] != buyer_id


def test_idor_and_bola_authorization_protection():
    # Login Buyer
    r_buyer = client.post("/api/auth/login", json={"email": "buyer@accord.demo", "password": "AccordDemo2026!"})
    b_tok = r_buyer.json()["access_token"]

    # Login Seller
    r_seller = client.post("/api/auth/login", json={"email": "seller@accord.demo", "password": "AccordDemo2026!"})
    s_tok = r_seller.json()["access_token"]

    # 1. Buyer tries to update seller's listing (Must return 404/403)
    r_hack = client.patch(
        "/api/listings/list_iphone14pro",
        headers={"Authorization": f"Bearer {b_tok}"},
        json={"price": 100},
    )
    assert r_hack.status_code in (404, 403)

    # 2. Seller CAN update their own listing
    r_own = client.patch(
        "/api/listings/list_iphone14pro",
        headers={"Authorization": f"Bearer {s_tok}"},
        json={"price": 68000},
    )
    assert r_own.status_code == 200

    # 3. Register a 3rd party user who is NOT part of Deal AC-10482
    client.post(
        "/api/auth/signup",
        json={"name": "Outsider", "email": "outsider@accord.demo", "password": "OutsiderPass2026!"},
    )
    r_out_login = client.post(
        "/api/auth/login",
        json={"email": "outsider@accord.demo", "password": "OutsiderPass2026!"},
    )
    assert r_out_login.status_code == 200
    out_tok = r_out_login.json()["access_token"]

    # 4. Outsider tries to access deal_demo_iphone (Must be 404 - no leak)
    r_deal_leak = client.get("/api/deals/deal_demo_iphone", headers={"Authorization": f"Bearer {out_tok}"})
    assert r_deal_leak.status_code == 404

    # 5. Outsider tries to access dispute_demo_iphone (Must be 404)
    r_disp_leak = client.get("/api/disputes/disp_demo_iphone", headers={"Authorization": f"Bearer {out_tok}"})
    assert r_disp_leak.status_code == 404
