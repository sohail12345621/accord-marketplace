"""Deal domain logic: authorization, message ingestion (risk + commitments + support), transitions."""

import re
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Commitment, Deal, DealEvent, Message, User, now
from ..serializers import commitment_out, message_out
from .assistants import listing_context, support_assistant
from .commitments import extract_commitments, values_conflict
from .risk import analyze_risk
from .state_machine import assert_transition
from ..config import get_settings

MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def new_code(prefix: str) -> str:
    return f"{prefix}-{secrets.randbelow(90000) + 10000}"


def role_in(deal: Deal, user: User) -> str | None:
    if deal.buyer_id == user.id:
        return "buyer"
    if deal.seller_id == user.id:
        return "seller"
    if user.role == "support":
        return "support"
    return None


def get_deal_for(db: Session, deal_id: str, user: User, allow_support: bool = True) -> tuple[Deal, str]:
    deal = db.get(Deal, deal_id)
    role = role_in(deal, user) if deal else None
    if not deal or role is None or (role == "support" and not allow_support):
        raise HTTPException(404, "Deal not found")  # 404 (not 403) avoids leaking existence (IDOR)
    return deal, role


def parse_due(value: str, base: datetime) -> datetime | None:
    v = value.lower()
    if "day after tomorrow" in v:
        return (base + timedelta(days=2)).replace(hour=23, minute=59)
    if "tomorrow" in v:
        return (base + timedelta(days=1)).replace(hour=23, minute=59)
    if "today" in v or "tonight" in v:
        return base.replace(hour=23, minute=59)
    if m := re.search(r"within (\d+) (day|hour)", v):
        n = int(m.group(1))
        return base + (timedelta(days=n) if m.group(2) == "day" else timedelta(hours=n))
    m = re.search(r"(\d{1,2})\w*\s+([a-z]{3})", v) or re.search(r"([a-z]{3})[a-z]*\s+(\d{1,2})", v)
    if m:
        a, b = m.groups()
        day, mon = (a, b) if a.isdigit() else (b, a)
        if mon[:3] in MONTHS:
            try:
                d = datetime(base.year, MONTHS[mon[:3]], int(day), 23, 59)
                return d if d >= base - timedelta(days=60) else d.replace(year=base.year + 1)
            except ValueError:
                return None
    return None


def log_event(db: Session, deal: Deal, actor: User | None, to: str, note: str = "") -> None:
    db.add(DealEvent(deal_id=deal.id, actor_id=actor.id if actor else None, from_state=deal.state, to_state=to, note=note))
    deal.state = to


def system_message(db: Session, deal: Deal, text: str) -> Message:
    m = Message(deal_id=deal.id, sender_id=None, kind="system", body=text, transport="local")
    db.add(m)
    deal.last_message_at = now()
    return m


def transition(db: Session, deal: Deal, actor: User | None, role: str, to: str, note: str = "") -> None:
    assert_transition(deal.state, to, role)
    log_event(db, deal, actor, to, note)


def add_commitments(db: Session, deal: Deal, msg: Message | None, party: str, items: list[dict], origin_override: str | None = None) -> tuple[list, list, list]:
    """Returns (auto_added, pending, conflicts_for_buyer)."""
    s = get_settings()
    added, pending, conflicts = [], [], []
    existing = list(db.scalars(select(Commitment).where(Commitment.deal_id == deal.id, Commitment.status.in_(["active", "pending", "discrepancy", "fulfilled"]))))
    for it in items:
        if it["confidence"] < s.commitment_min_confidence:
            continue
        if party == "buyer" and it["type"] not in ("PRICE", "FULFILLMENT"):
            # Buyer stating a product value is a *report*, not a commitment.
            if any(c.party == "seller" and c.attribute == it["attribute"] and values_conflict(c.value, it["value"]) for c in existing):
                conflicts.append(it)
            continue
        same = [c for c in existing if c.attribute == it["attribute"] and c.party == party and (it["type"] != "INCLUDED_ITEM" or c.value == it["value"])]
        if any(not values_conflict(c.value, it["value"]) for c in same):
            continue  # already recorded
        auto = it["confidence"] >= s.commitment_auto_confidence
        c = Commitment(deal_id=deal.id, message_id=msg.id if msg else None, party=party, type=it["type"], attribute=it["attribute"],
                       label=it["label"], value=it["value"], source_text=it["quote"], confidence=it["confidence"],
                       origin=origin_override or "ai_extracted", status="active" if auto else "pending")
        if it["type"] == "FULFILLMENT":
            c.due_at = parse_due(it["value"], msg.sent_at if msg else now())
        if auto:
            for old in same:  # newer explicit statement supersedes older value (history preserved)
                if old.status in ("active", "pending"):
                    old.status = "superseded"
        db.add(c)
        existing.append(c)
        (added if auto else pending).append(c)
    return added, pending, conflicts


def ingest_message(db: Session, deal: Deal, sender: User, body: str, nexconn_id: str | None, transport: str) -> dict:
    role = role_in(deal, sender)
    if role not in ("buyer", "seller"):
        raise HTTPException(403, "Only deal participants can message")
    if deal.state in ("CANCELLED",):
        raise HTTPException(409, "This deal is cancelled")
    if nexconn_id:
        dup = db.scalar(select(Message).where(Message.nexconn_message_id == nexconn_id))
        if dup:  # idempotent (client POST + webhook may both deliver)
            return {"message": message_out(dup), "duplicate": True}
    prior_flags = db.scalar(select(func.count()).select_from(Message).where(Message.deal_id == deal.id, Message.sender_id == sender.id, Message.risk_level.in_(["medium", "high"]))) or 0
    risk = analyze_risk(body, prior_flags)
    msg = Message(deal_id=deal.id, sender_id=sender.id, body=body, nexconn_message_id=nexconn_id, transport=transport,
                  risk_level=risk["level"], risk_reasons=risk["reasons"])
    db.add(msg)
    db.flush()
    deal.last_message_at = msg.sent_at
    if role == "buyer":
        deal.buyer_last_read = msg.sent_at
    else:
        deal.seller_last_read = msg.sent_at
    if deal.state == "CONVERSATION_STARTED":
        log_event(db, deal, None, "NEGOTIATING", "First message exchanged")

    extracted = extract_commitments(body, role, listing_context(deal.listing)) if risk["level"] != "high" else []
    added, pending, _ = add_commitments(db, deal, msg, role, extracted)
    all_c = list(db.scalars(select(Commitment).where(Commitment.deal_id == deal.id)))
    assist = support_assistant.analyze(deal, body, role, extracted, all_c)
    db.commit()
    return {"message": message_out(msg), "risk": risk, "commitments_added": [commitment_out(c) for c in added],
            "commitments_pending": [commitment_out(c) for c in pending], "assist": assist}


def unread_counts(db: Session, user: User, deals: list[Deal]) -> dict[str, int]:
    if not deals:
        return {}
    out: dict[str, int] = {}
    # One grouped query per side (no N+1)
    for side, col in (("buyer", Deal.buyer_last_read), ("seller", Deal.seller_last_read)):
        ids = [d.id for d in deals if getattr(d, f"{side}_id") == user.id]
        if not ids:
            continue
        rows = db.execute(
            select(Message.deal_id, func.count()).join(Deal, Deal.id == Message.deal_id)
            .where(Message.deal_id.in_(ids), Message.sent_at > col, (Message.sender_id != user.id) | (Message.sender_id.is_(None)))
            .group_by(Message.deal_id)
        ).all()
        out.update({k: v for k, v in rows})
    return out
