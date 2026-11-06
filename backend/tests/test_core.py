import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models import User
from app.services.commitments import extract_commitments
from app.services.risk import analyze_risk
from app.services.trust import trust_profile
from tests.conftest import TestingSessionLocal


@pytest.fixture
def client():
    return TestClient(app)


def login(client, email="buyer@accord.demo", password="AccordDemo2026!"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# 1. Commitment Extraction Unit Tests (The Non-Negotiable USP)
def test_commitment_extraction():
    text = "Battery health is 92%, original charger included, no repairs at all."
    commitments = extract_commitments(text, speaker="seller", listing_ctx={"category": "Smartphones"})
    attrs = {c["attribute"]: c["value"] for c in commitments}

    assert "battery_health" in attrs
    assert attrs["battery_health"] == "92%"
    assert "original_charger" in attrs
    assert "repair_history" in attrs
    assert attrs["repair_history"] == "No previous repairs"


# 2. Risk Detection Unit Tests
def test_risk_detection():
    safe_msg = "Is tomorrow morning convenient for pickup?"
    res_safe = analyze_risk(safe_msg)
    assert res_safe["level"] == "none"

    scam_msg = "Don't pay here. Send ₹5,000 to my UPI and I'll reserve it for you."
    res_scam = analyze_risk(scam_msg)
    assert res_scam["level"] in ("medium", "high")
    assert any("outside the platform" in r for r in res_scam["reasons"])


# 3. Deterministic Trust Score
def test_trust_score():
    db = TestingSessionLocal()
    seller = db.query(User).filter_by(email="seller@accord.demo").first()
    t = trust_profile(seller)
    assert t["score"] >= 80
    assert t["band"] == "Highly Trusted"
    assert len(t["reasons"]) > 0


# 4. Authentication flow
def test_auth_and_protected_routes(client):
    headers = login(client)
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["email"] == "buyer@accord.demo"


# 5. Marketplace Listings & Ask Accord
def test_marketplace_and_ask(client):
    headers = login(client)
    res = client.get("/api/listings")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) > 0

    first_id = items[0]["id"]
    res_ask = client.post(
        f"/api/listings/{first_id}/ask",
        headers=headers,
        json={"question": "Is this price reasonable?"},
    )
    assert res_ask.status_code == 200
    assert len(res_ask.json()["points"]) > 0


# 6. Deal Conversation & Auto-Commitment Ingestion
def test_conversation_and_deal_ledger(client):
    headers = login(client, email="seller@accord.demo")
    # Post a message making a new promise
    res = client.post(
        "/api/deals/deal_demo_iphone/messages",
        headers=headers,
        json={"body": "Cycle count is 140, and I will include an extra case for free."},
    )
    assert res.status_code == 201
    data = res.json()
    assert "message" in data
    assert len(data.get("commitments_added", [])) + len(data.get("commitments_pending", [])) > 0


# 7. Dispute Workflow & AI Summary
def test_dispute_workspace(client):
    headers = login(client, email="buyer@accord.demo")
    res = client.get("/api/disputes/disp_demo_iphone", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["dispute"]["code"] == "AC-20491"
    assert "summary" in data
    assert data["summary"]["assessment"] is not None
