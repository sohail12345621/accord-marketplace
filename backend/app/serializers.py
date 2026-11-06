from datetime import datetime

from .models import Commitment, Deal, Dispute, Evidence, Listing, Message, User
from .services.trust import trust_profile


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def public_user(u: User, with_trust: bool = True) -> dict:
    d = {"id": u.id, "name": u.name, "city": u.city, "avatar_color": u.avatar_color, "role": u.role,
         "verified": u.verified_identity, "member_since": iso(u.member_since)}
    if with_trust:
        t = trust_profile(u)
        d["trust"] = {"score": t["score"], "band": t["band"]}
    return d


def me_user(u: User) -> dict:
    return {**public_user(u), "email": u.email}


def listing_out(listing: Listing, full: bool = False) -> dict:
    d = {"id": listing.id, "title": listing.title, "category": listing.category, "price": listing.price,
         "condition": listing.condition, "location": listing.location, "image_url": listing.image_url,
         "status": listing.status, "created_at": iso(listing.created_at), "specs": listing.specs or {},
         "seller": public_user(listing.seller)}
    if full:
        d.update(description=listing.description, history=listing.history or [], views=listing.views,
                 seller_trust=trust_profile(listing.seller))
    return d


def message_out(m: Message) -> dict:
    return {"id": m.id, "deal_id": m.deal_id, "sender_id": m.sender_id, "kind": m.kind, "body": m.body,
            "nexconn_message_id": m.nexconn_message_id, "transport": m.transport, "risk_level": m.risk_level,
            "risk_reasons": m.risk_reasons or [], "sent_at": iso(m.sent_at)}


def commitment_out(c: Commitment) -> dict:
    return {"id": c.id, "deal_id": c.deal_id, "message_id": c.message_id, "party": c.party, "type": c.type,
            "attribute": c.attribute, "label": c.label, "value": c.value, "source_text": c.source_text,
            "confidence": round(c.confidence, 2), "origin": c.origin, "status": c.status,
            "reported_value": c.reported_value, "due_at": iso(c.due_at), "created_at": iso(c.created_at)}


def deal_brief(d: Deal, me: User) -> dict:
    role = "buyer" if d.buyer_id == me.id else "seller" if d.seller_id == me.id else "support"
    other = d.seller if role == "buyer" else d.buyer
    return {"id": d.id, "code": d.code, "state": d.state, "role": role, "agreed_price": d.agreed_price,
            "proposed_price": d.proposed_price, "proposed_by": d.proposed_by,
            "listing": {"id": d.listing.id, "title": d.listing.title, "price": d.listing.price,
                        "image_url": d.listing.image_url, "category": d.listing.category},
            "counterpart": {**public_user(other), "chat_id": other.chat_id},
            "buyer": public_user(d.buyer, False), "seller": public_user(d.seller, False),
            "last_message_at": iso(d.last_message_at), "created_at": iso(d.created_at)}


def dispute_out(x: Dispute) -> dict:
    return {"id": x.id, "code": x.code, "deal_id": x.deal_id, "deal_code": x.deal.code, "issue": x.issue,
            "description": x.description, "reported_value": x.reported_value, "status": x.status,
            "resolution": x.resolution, "resolution_note": x.resolution_note, "commitment_id": x.commitment_id,
            "opened_by": x.opened_by, "listing_title": x.deal.listing.title, "created_at": iso(x.created_at),
            "updated_at": iso(x.updated_at)}


def evidence_out(e: Evidence) -> dict:
    return {"id": e.id, "role": e.role, "kind": e.kind, "text": e.text, "file_name": e.file_name,
            "file_mime": e.file_mime, "created_at": iso(e.created_at), "submitted_by": e.submitted_by}
