from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Commitment, Deal, DealEvent, Dispute, Message, RiskReport, User, now
from ..security import current_user
from ..serializers import commitment_out, deal_brief, iso, message_out, public_user
from ..services.assistants import negotiation_assistant
from ..services.commitments import values_conflict
from ..services.deals import get_deal_for, ingest_message, system_message, transition, unread_counts, log_event, add_commitments
from ..services.state_machine import ACTIVE_LEDGER_STATES, DISPUTABLE, available_actions
from ..services.trust import trust_profile

router = APIRouter(prefix="/api", tags=["deals"])


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    nexconn_message_id: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_\-:.]+$")

    @field_validator("body")
    @classmethod
    def strip(cls, v: str) -> str:
        v = v.replace("\x00", "").strip()
        if not v:
            raise ValueError("Empty message")
        return v


class PriceIn(BaseModel):
    price: int = Field(gt=0, le=10_000_000)


class TransitionIn(BaseModel):
    to: str = Field(max_length=24)
    note: str = Field(default="", max_length=300)


class ReportValueIn(BaseModel):
    value: str = Field(min_length=1, max_length=200)


class RiskReportIn(BaseModel):
    reason: str = Field(default="", max_length=300)


def _ledger(db: Session, deal: Deal) -> list[Commitment]:
    return list(db.scalars(select(Commitment).where(Commitment.deal_id == deal.id).order_by(Commitment.created_at)))


def deal_detail(db: Session, deal: Deal, role: str, user: User) -> dict:
    commitments = _ledger(db, deal)
    events = db.scalars(select(DealEvent).where(DealEvent.deal_id == deal.id).order_by(DealEvent.created_at)).all()
    dispute = db.scalar(select(Dispute).where(Dispute.deal_id == deal.id).order_by(Dispute.created_at.desc()))
    actions = available_actions(deal.state, role)
    return {
        **deal_brief(deal, user), "role": role,
        "commitments": [commitment_out(c) for c in commitments],
        "events": [{"from": e.from_state, "to": e.to_state, "note": e.note, "at": iso(e.created_at)} for e in events],
        "actions": actions,
        "can_dispute": deal.state in DISPUTABLE and role in ("buyer", "seller") and not (dispute and dispute.status != "resolved"),
        "dispute": {"id": dispute.id, "code": dispute.code, "status": dispute.status} if dispute else None,
        "counterpart_trust": trust_profile(deal.seller if role == "buyer" else deal.buyer),
        "listing_full": {"specs": deal.listing.specs, "condition": deal.listing.condition, "location": deal.listing.location},
    }


@router.get("/deals")
def my_deals(scope: str = Query("all", pattern="^(all|orders)$"), user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Deal).where(or_(Deal.buyer_id == user.id, Deal.seller_id == user.id))
    if scope == "orders":
        stmt = stmt.where(Deal.state.notin_(["CONVERSATION_STARTED", "NEGOTIATING"]))
    deals = db.scalars(stmt.order_by(Deal.last_message_at.desc()).limit(100)).unique().all()
    unread = unread_counts(db, user, deals)
    ids = [d.id for d in deals]
    last: dict[str, Message] = {}
    if ids:  # latest message per deal in one query
        from sqlalchemy import func
        sub = select(Message.deal_id, func.max(Message.sent_at).label("mx")).where(Message.deal_id.in_(ids)).group_by(Message.deal_id).subquery()
        for m in db.scalars(select(Message).join(sub, (Message.deal_id == sub.c.deal_id) & (Message.sent_at == sub.c.mx))):
            last[m.deal_id] = m
    counts: dict[str, int] = {}
    if ids:
        from sqlalchemy import func
        counts = dict(db.execute(select(Commitment.deal_id, func.count()).where(Commitment.deal_id.in_(ids), Commitment.status.in_(["active", "fulfilled", "discrepancy"])).group_by(Commitment.deal_id)).all())
    out = []
    for d in deals:
        b = deal_brief(d, user)
        m = last.get(d.id)
        b.update(unread=unread.get(d.id, 0), commitment_count=counts.get(d.id, 0),
                 last_message={"body": m.body[:120], "sender_id": m.sender_id, "kind": m.kind, "risk_level": m.risk_level} if m else None)
        out.append(b)
    return out


@router.get("/deals/{deal_id}")
def get_deal(deal_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    deal, role = get_deal_for(db, deal_id, user)
    return deal_detail(db, deal, role, user)


@router.get("/deals/{deal_id}/messages")
def get_messages(deal_id: str, before: datetime | None = None, after: datetime | None = None,
                 limit: int = Query(40, ge=1, le=100), user: User = Depends(current_user), db: Session = Depends(get_db)):
    deal, _ = get_deal_for(db, deal_id, user)
    stmt = select(Message).where(Message.deal_id == deal.id)
    if after:
        stmt = stmt.where(Message.sent_at > after.replace(tzinfo=None)).order_by(Message.sent_at.asc()).limit(limit)
        return {"items": [message_out(m) for m in db.scalars(stmt)], "has_more": False}
    if before:
        stmt = stmt.where(Message.sent_at < before.replace(tzinfo=None))
    rows = list(db.scalars(stmt.order_by(Message.sent_at.desc()).limit(limit + 1)))
    has_more = len(rows) > limit
    return {"items": [message_out(m) for m in reversed(rows[:limit])], "has_more": has_more}


@router.post("/deals/{deal_id}/messages", status_code=201)
def post_message(deal_id: str, body: MessageIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    deal, _ = get_deal_for(db, deal_id, user, allow_support=False)
    # Sender identity comes from the verified session — never from client-supplied metadata.
    return ingest_message(db, deal, user, body.body, body.nexconn_message_id, "nexconn" if body.nexconn_message_id else "local")


@router.post("/deals/{deal_id}/read")
def mark_read(deal_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    deal, role = get_deal_for(db, deal_id, user, allow_support=False)
    setattr(deal, f"{role}_last_read", now())
    db.commit()
    return {"ok": True}


@router.post("/deals/{deal_id}/propose")
def propose(deal_id: str, body: PriceIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    deal, role = get_deal_for(db, deal_id, user, allow_support=False)
    if deal.state not in ("CONVERSATION_STARTED", "NEGOTIATING"):
        raise HTTPException(409, "Price can only be proposed while negotiating")
    deal.proposed_price, deal.proposed_by = body.price, role
    system_message(db, deal, f"{user.name} proposed a final price of ₹{body.price:,}. Waiting for the {'seller' if role == 'buyer' else 'buyer'} to accept.")
    db.commit()
    return deal_detail(db, deal, role, user)


@router.post("/deals/{deal_id}/accept")
def accept(deal_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    deal, role = get_deal_for(db, deal_id, user, allow_support=False)
    if not deal.proposed_price or deal.proposed_by == role:
        raise HTTPException(409, "There is no proposal from the other party to accept")
    transition(db, deal, user, "system", "AGREED", f"Agreed at ₹{deal.proposed_price:,}")
    deal.agreed_price = deal.proposed_price
    # Price + pending seller commitments become part of the agreed deal.
    for c in db.scalars(select(Commitment).where(Commitment.deal_id == deal.id, Commitment.attribute == "agreed_price", Commitment.status.in_(["active", "pending"]))):
        c.status = "superseded"
    for party in ("buyer", "seller"):
        db.add(Commitment(deal_id=deal.id, party=party, type="PRICE", attribute="agreed_price", label="Agreed Price",
                          value=f"₹{deal.agreed_price:,}", source_text="Price proposal accepted in Accord", confidence=1.0,
                          origin="confirmed", status="active"))
    system_message(db, deal, f"Deal agreed at ₹{deal.agreed_price:,}. Commitments made in this conversation are now part of Deal {deal.code}.")
    db.commit()
    return deal_detail(db, deal, role, user)


@router.post("/deals/{deal_id}/transition")
def do_transition(deal_id: str, body: TransitionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    deal, role = get_deal_for(db, deal_id, user)
    to = body.to
    transition(db, deal, user, role, to, body.note)
    msgs = {"PAYMENT_PENDING": "Buyer is proceeding to payment.", "PAID": f"Payment of ₹{(deal.agreed_price or 0):,} secured in Accord escrow (simulated).",
            "FULFILLMENT_PENDING": "Seller accepted the order and is preparing it.", "FULFILLED": "Seller marked the item as shipped / handed over.",
            "COMPLETED": "Buyer confirmed the item was received as described. Escrow released.", "CANCELLED": f"Deal cancelled by {role}."}
    system_message(db, deal, msgs.get(to, f"Deal moved to {to}"))
    if to == "FULFILLED":
        for c in _ledger(db, deal):
            if c.type == "FULFILLMENT" and c.status == "active" and c.attribute == "shipping_date":
                c.status = "fulfilled"
    if to == "COMPLETED":
        kept = [c for c in _ledger(db, deal) if c.party == "seller" and c.status in ("active", "fulfilled")]
        for c in kept:
            c.status = "fulfilled"
        s = deal.seller
        s.completed_transactions += 1
        s.commitments_kept += len(kept)
        s.commitments_total += len(kept)
        deal.buyer.completed_transactions += 1
        deal.listing.status = "sold"
    db.commit()
    return deal_detail(db, deal, role, user)


@router.post("/deals/{deal_id}/assist")
def assist(deal_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    deal, _ = get_deal_for(db, deal_id, user)
    return negotiation_assistant.suggest(db, deal, _ledger(db, deal))


def _commitment_for(db: Session, cid: str, user: User) -> tuple[Commitment, Deal, str]:
    c = db.get(Commitment, cid)
    if not c:
        raise HTTPException(404, "Commitment not found")
    deal, role = get_deal_for(db, c.deal_id, user, allow_support=False)
    return c, deal, role


@router.post("/commitments/{cid}/confirm")
def confirm(cid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c, deal, role = _commitment_for(db, cid, user)
    if c.status != "pending":
        raise HTTPException(409, "Commitment is not pending")
    for old in db.scalars(select(Commitment).where(Commitment.deal_id == deal.id, Commitment.attribute == c.attribute, Commitment.party == c.party,
                                                   Commitment.status == "active", Commitment.id != c.id)):
        if c.type != "INCLUDED_ITEM" or old.value == c.value:
            old.status = "superseded"
    c.status, c.origin = "active", "confirmed"
    db.commit()
    return commitment_out(c)


@router.post("/commitments/{cid}/reject")
def reject(cid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c, deal, role = _commitment_for(db, cid, user)
    if c.status != "pending":
        raise HTTPException(409, "Only pending commitments can be ignored")
    c.status = "rejected"
    db.commit()
    return commitment_out(c)


@router.post("/commitments/{cid}/report")
def report_value(cid: str, body: ReportValueIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Buyer verification: records the observed value; mismatch => discrepancy."""
    c, deal, role = _commitment_for(db, cid, user)
    if role != "buyer" or c.party != "seller":
        raise HTTPException(403, "Only the buyer can verify seller commitments")
    if c.status not in ("active", "fulfilled", "discrepancy"):
        raise HTTPException(409, "Commitment is not active")
    if deal.state not in ("PAID", "FULFILLMENT_PENDING", "FULFILLED", "COMPLETED", "DISPUTED"):
        raise HTTPException(409, "Verification is available after payment")
    c.reported_value, c.reported_by = body.value.strip(), user.id
    c.status = "discrepancy" if values_conflict(c.value, c.reported_value) else "fulfilled"
    if c.status == "discrepancy":
        system_message(db, deal, f"⚠ Commitment discrepancy — {c.label}: seller stated {c.value}, buyer reports {c.reported_value}.")
    db.commit()
    return commitment_out(c)


@router.post("/messages/{mid}/report", status_code=201)
def report_message(mid: str, body: RiskReportIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = db.get(Message, mid)
    if not m or not m.sender_id:
        raise HTTPException(404, "Message not found")
    deal, role = get_deal_for(db, m.deal_id, user, allow_support=False)
    if m.sender_id == user.id:
        raise HTTPException(400, "You cannot report your own message")
    if db.scalar(select(RiskReport).where(RiskReport.message_id == m.id, RiskReport.reporter_id == user.id)):
        return {"ok": True, "already_reported": True}
    db.add(RiskReport(message_id=m.id, reporter_id=user.id, reported_user_id=m.sender_id, reason=body.reason))
    db.commit()
    return {"ok": True}


# keep imports referenced for linters
_ = (ACTIVE_LEDGER_STATES, public_user, log_event, add_commitments)
