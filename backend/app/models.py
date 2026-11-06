import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def uid() -> str:
    return uuid.uuid4().hex


def chat_uid() -> str:
    # Deterministic or non-sequential Nexconn user id (docs recommend avoiding sequential ids).
    return "accord_" + uuid.uuid4().hex


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class User(Timestamped, Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default="user")  # user | support
    chat_id: Mapped[str] = mapped_column(String(64), unique=True, default=chat_uid)

    def __init__(self, **kwargs):
        if "id" not in kwargs:
            kwargs["id"] = uid()
        if "chat_id" not in kwargs or not kwargs["chat_id"]:
            kwargs["chat_id"] = f"accord_{kwargs['id']}"
        super().__init__(**kwargs)
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    city: Mapped[str] = mapped_column(String(80), default="")
    avatar_color: Mapped[str] = mapped_column(String(16), default="#0f766e")
    # Trust inputs (deterministic, explainable)
    verified_identity: Mapped[bool] = mapped_column(Boolean, default=False)
    member_since: Mapped[datetime] = mapped_column(DateTime, default=now)
    completed_transactions: Mapped[int] = mapped_column(Integer, default=0)
    disputed_transactions: Mapped[int] = mapped_column(Integer, default=0)
    disputes_lost: Mapped[int] = mapped_column(Integer, default=0)
    response_rate: Mapped[float] = mapped_column(Float, default=0.0)
    rating_sum: Mapped[float] = mapped_column(Float, default=0.0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    commitments_kept: Mapped[int] = mapped_column(Integer, default=0)
    commitments_total: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (CheckConstraint("role in ('user','support')", name="ck_user_role"),)


class Listing(Timestamped, Base):
    __tablename__ = "listings"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    seller_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(140))
    category: Mapped[str] = mapped_column(String(32), index=True)
    price: Mapped[int] = mapped_column(Integer)
    condition: Mapped[str] = mapped_column(String(32))
    location: Mapped[str] = mapped_column(String(80))
    image_url: Mapped[str] = mapped_column(String(500), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    specs: Mapped[dict] = mapped_column(JSON, default=dict)
    history: Mapped[list] = mapped_column(JSON, default=list)  # [{at, event}]
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)
    views: Mapped[int] = mapped_column(Integer, default=0)
    seller: Mapped[User] = relationship(lazy="joined")

    __table_args__ = (CheckConstraint("price > 0", name="ck_listing_price"),)


class Deal(Timestamped, Base):
    """A buyer-seller conversation about a listing, plus its transaction + Deal Ledger."""

    __tablename__ = "deals"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(16), unique=True)
    listing_id: Mapped[str] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), index=True)
    buyer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    seller_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    state: Mapped[str] = mapped_column(String(24), default="CONVERSATION_STARTED", index=True)
    agreed_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    proposed_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    proposed_by: Mapped[str | None] = mapped_column(String(32), nullable=True)
    last_message_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
    buyer_last_read: Mapped[datetime] = mapped_column(DateTime, default=now)
    seller_last_read: Mapped[datetime] = mapped_column(DateTime, default=now)

    listing: Mapped[Listing] = relationship(lazy="joined")
    buyer: Mapped[User] = relationship(foreign_keys=[buyer_id], lazy="joined")
    seller: Mapped[User] = relationship(foreign_keys=[seller_id], lazy="joined")

    __table_args__ = (UniqueConstraint("listing_id", "buyer_id", name="uq_deal_listing_buyer"),)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    deal_id: Mapped[str] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"))
    sender_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)  # None = system
    kind: Mapped[str] = mapped_column(String(16), default="text")  # text | system
    body: Mapped[str] = mapped_column(Text)
    nexconn_message_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    transport: Mapped[str] = mapped_column(String(16), default="local")  # nexconn | local | seed
    risk_level: Mapped[str] = mapped_column(String(8), default="none")  # none | low | medium | high
    risk_reasons: Mapped[list] = mapped_column(JSON, default=list)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    __table_args__ = (Index("ix_messages_deal_sent", "deal_id", "sent_at"),)


class Commitment(Timestamped, Base):
    __tablename__ = "commitments"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    deal_id: Mapped[str] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), index=True)
    message_id: Mapped[str | None] = mapped_column(ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    party: Mapped[str] = mapped_column(String(8))  # seller | buyer
    type: Mapped[str] = mapped_column(String(24))  # PRODUCT_ATTRIBUTE | INCLUDED_ITEM | FULFILLMENT | PRICE | CONDITION
    attribute: Mapped[str] = mapped_column(String(48))
    label: Mapped[str] = mapped_column(String(80))
    value: Mapped[str] = mapped_column(String(200))
    source_text: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    origin: Mapped[str] = mapped_column(String(16), default="ai_extracted")  # ai_extracted | confirmed | manual
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    # pending | active | fulfilled | discrepancy | rejected | superseded
    reported_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reported_by: Mapped[str | None] = mapped_column(String(32), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class DealEvent(Base):
    __tablename__ = "deal_events"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    deal_id: Mapped[str] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    from_state: Mapped[str] = mapped_column(String(24))
    to_state: Mapped[str] = mapped_column(String(24))
    note: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Dispute(Timestamped, Base):
    __tablename__ = "disputes"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(16), unique=True)
    deal_id: Mapped[str] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), index=True)
    opened_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    commitment_id: Mapped[str | None] = mapped_column(ForeignKey("commitments.id", ondelete="SET NULL"), nullable=True)
    issue: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    reported_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    # open | awaiting_seller | under_review | resolved
    resolution: Mapped[str | None] = mapped_column(String(40), nullable=True)
    resolution_note: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    deal: Mapped[Deal] = relationship(lazy="joined")


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    dispute_id: Mapped[str] = mapped_column(ForeignKey("disputes.id", ondelete="CASCADE"), index=True)
    submitted_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String(8))  # buyer | seller | support
    kind: Mapped[str] = mapped_column(String(12), default="statement")  # statement | file | note
    text: Mapped[str] = mapped_column(Text, default="")
    file_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    file_mime: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class RiskReport(Base):
    __tablename__ = "risk_reports"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    message_id: Mapped[str] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"))
    reporter_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    reported_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(String(300), default="")
    status: Mapped[str] = mapped_column(String(16), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    __table_args__ = (UniqueConstraint("message_id", "reporter_id", name="uq_report_once"),)
