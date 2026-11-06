import os
import secrets
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Commitment, Deal, Dispute, Evidence, Message, User
from ..security import current_user, require_support
from ..serializers import commitment_out, dispute_out, evidence_out, listing_out, message_out, public_user
from ..services.assistants import dispute_summarizer
from ..services.deals import get_deal_for, new_code, system_message, transition
from ..services.state_machine import DISPUTABLE

router = APIRouter(prefix="/api", tags=["disputes"])
settings = get_settings()

# Magic-byte allowlist: extension and declared MIME must agree with file content.
ALLOWED = {
    "image/png": ([b"\x89PNG\r\n\x1a\n"], ".png"),
    "image/jpeg": ([b"\xff\xd8\xff"], ".jpg"),
    "image/webp": ([b"RIFF"], ".webp"),
    "application/pdf": ([b"%PDF-"], ".pdf"),
}
EXT_OK = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf"}


class DisputeIn(BaseModel):
    issue: str = Field(min_length=4, max_length=160)
    description: str = Field(default="", max_length=2000)
    commitment_id: str | None = Field(default=None, max_length=32)
    reported_value: str | None = Field(default=None, max_length=200)


class EvidenceIn(BaseModel):
    text: str = Field(min_length=2, max_length=2000)


class StatusIn(BaseModel):
    status: Literal["awaiting_seller", "under_review"]


class ResolveIn(BaseModel):
    resolution: Literal["refund_buyer", "partial_refund", "release_to_seller", "no_action"]
    note: str = Field(min_length=5, max_length=2000)


def _dispute_for(db: Session, did: str, user: User) -> tuple[Dispute, str]:
    d = db.get(Dispute, did)
    if not d:
        raise HTTPException(404, "Dispute not found")
    _, role = get_deal_for(db, d.deal_id, user)  # 404 for non-participants (BOLA protection)
    return d, role


@router.post("/deals/{deal_id}/disputes", status_code=201)
def open_dispute(deal_id: str, body: DisputeIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    deal, role = get_deal_for(db, deal_id, user, allow_support=False)
    if deal.state not in DISPUTABLE:
        raise HTTPException(409, "Disputes can be opened after payment")
    if db.scalar(select(Dispute).where(Dispute.deal_id == deal.id, Dispute.status != "resolved")):
        raise HTTPException(409, "A dispute is already open for this deal")
    commit = None
    if body.commitment_id:
        commit = db.get(Commitment, body.commitment_id)
        if not commit or commit.deal_id != deal.id:
            raise HTTPException(422, "Commitment does not belong to this deal")
        if body.reported_value and role == "buyer":
            commit.reported_value, commit.reported_by = body.reported_value, user.id
            commit.status = "discrepancy"
    d = Dispute(code=new_code("DS"), deal_id=deal.id, opened_by=user.id, commitment_id=commit.id if commit else None,
                issue=body.issue.strip(), description=body.description.strip(),
                reported_value=body.reported_value or (commit.reported_value if commit else None))
    db.add(d)
    if body.description.strip():
        db.flush()
        db.add(Evidence(dispute_id=d.id, submitted_by=user.id, role=role, kind="statement", text=body.description.strip()))
    transition(db, deal, user, "system", "DISPUTED", body.issue)
    deal.buyer.disputed_transactions += 0  # counters updated on resolution only
    system_message(db, deal, f"Dispute {d.code} opened: {d.issue}. Accord assembled the conversation evidence for support.")
    db.flush()
    d.summary = dispute_summarizer.build(db, d)
    db.commit()
    return dispute_out(d)


@router.get("/disputes")
def list_disputes(user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Dispute).join(Deal, Deal.id == Dispute.deal_id)
    if user.role != "support":
        stmt = stmt.where(or_(Deal.buyer_id == user.id, Deal.seller_id == user.id))
    return [dispute_out(d) for d in db.scalars(stmt.order_by(Dispute.created_at.desc()).limit(100)).unique()]


@router.get("/disputes/{did}")
def get_dispute(did: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d, role = _dispute_for(db, did, user)
    deal = d.deal
    commitments = db.scalars(select(Commitment).where(Commitment.deal_id == deal.id).order_by(Commitment.created_at)).all()
    src_ids = {c.message_id for c in commitments if c.message_id}
    rel = db.scalars(select(Message).where(Message.deal_id == deal.id, or_(Message.id.in_(src_ids), Message.risk_level == "high", Message.kind == "system")).order_by(Message.sent_at)).all()
    evidence = db.scalars(select(Evidence).where(Evidence.dispute_id == d.id).order_by(Evidence.created_at)).all()
    return {
        "dispute": dispute_out(d), "role": role, "summary": d.summary,
        "deal": {"id": deal.id, "code": deal.code, "state": deal.state, "agreed_price": deal.agreed_price,
                 "buyer": public_user(deal.buyer), "seller": public_user(deal.seller)},
        "listing": listing_out(deal.listing),
        "commitments": [commitment_out(c) for c in commitments if c.status != "rejected"],
        "relevant_messages": [message_out(m) for m in rel],
        "evidence": [evidence_out(e) for e in evidence],
    }


@router.post("/disputes/{did}/evidence", status_code=201)
def add_evidence(did: str, body: EvidenceIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d, role = _dispute_for(db, did, user)
    if d.status == "resolved":
        raise HTTPException(409, "Dispute is resolved")
    e = Evidence(dispute_id=d.id, submitted_by=user.id, role=role, kind="note" if role == "support" else "statement", text=body.text.strip())
    db.add(e)
    if role == "seller" and d.status == "awaiting_seller":
        d.status = "under_review"
    db.flush()
    d.summary = dispute_summarizer.build(db, d)
    db.commit()
    return evidence_out(e)


@router.post("/disputes/{did}/evidence/file", status_code=201)
async def upload_evidence(did: str, file: UploadFile = File(...), caption: str = Form("", max_length=300),
                          user: User = Depends(current_user), db: Session = Depends(get_db)):
    d, role = _dispute_for(db, did, user)
    if d.status == "resolved" or role == "support":
        raise HTTPException(409, "Uploads are not accepted for this dispute")
    ext = Path(file.filename or "").suffix.lower()
    mime = EXT_OK.get(ext)
    if not mime or file.content_type != mime:
        raise HTTPException(415, "Only PNG, JPEG, WEBP or PDF files are allowed")
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, "File exceeds 5 MB")
    magics, safe_ext = ALLOWED[mime]
    if not any(data.startswith(m) for m in magics) or (mime == "image/webp" and data[8:12] != b"WEBP"):
        raise HTTPException(415, "File content does not match its type")
    if b"<script" in data[:4096].lower() or b"/javascript" in data.lower():
        raise HTTPException(415, "File rejected")
    upload_dir = Path(settings.upload_dir).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored = secrets.token_hex(16) + safe_ext  # random name; original name never touches the filesystem
    (upload_dir / stored).write_bytes(data)
    display = "".join(ch for ch in Path(file.filename or "file").stem if ch.isalnum() or ch in "-_ ")[:60] + safe_ext
    e = Evidence(dispute_id=d.id, submitted_by=user.id, role=role, kind="file", text=caption.strip(), file_name=display,
                 file_mime=f"{mime}|{stored}")
    db.add(e)
    db.flush()
    d.summary = dispute_summarizer.build(db, d)
    db.commit()
    return evidence_out(e)


@router.get("/evidence/{eid}/file")
def download_evidence(eid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    e = db.get(Evidence, eid)
    if not e or e.kind != "file" or not e.file_mime:
        raise HTTPException(404, "Not found")
    _dispute_for(db, e.dispute_id, user)
    mime, stored = e.file_mime.split("|", 1)
    path = (Path(settings.upload_dir).resolve() / stored).resolve()
    if path.parent != Path(settings.upload_dir).resolve() or not path.exists():
        raise HTTPException(404, "Not found")
    return FileResponse(path, media_type=mime, filename=e.file_name, content_disposition_type="attachment" if mime == "application/pdf" else "inline",
                        headers={"Content-Security-Policy": "default-src 'none'; sandbox", "X-Content-Type-Options": "nosniff"})


@router.post("/disputes/{did}/summary")
def regenerate_summary(did: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d, _ = _dispute_for(db, did, user)
    d.summary = dispute_summarizer.build(db, d)
    db.commit()
    return d.summary


@router.post("/disputes/{did}/status")
def set_status(did: str, body: StatusIn, user: User = Depends(require_support), db: Session = Depends(get_db)):
    d = db.get(Dispute, did)
    if not d or d.status == "resolved":
        raise HTTPException(404, "Open dispute not found")
    d.status = body.status
    if body.status == "awaiting_seller":
        system_message(db, d.deal, f"Accord Support requested the seller's response for dispute {d.code}.")
    d.summary = dispute_summarizer.build(db, d)
    db.commit()
    return dispute_out(d)


@router.post("/disputes/{did}/resolve")
def resolve(did: str, body: ResolveIn, user: User = Depends(require_support), db: Session = Depends(get_db)):
    """Human decision by a support agent. AI never resolves disputes."""
    d = db.get(Dispute, did)
    if not d or d.status == "resolved":
        raise HTTPException(404, "Open dispute not found")
    deal = d.deal
    d.status, d.resolution, d.resolution_note = "resolved", body.resolution, body.note.strip()
    db.add(Evidence(dispute_id=d.id, submitted_by=user.id, role="support", kind="note", text=f"Resolution: {body.resolution.replace('_', ' ')} — {body.note.strip()}"))
    transition(db, deal, user, "system", "RESOLVED", body.resolution)
    seller = deal.seller
    seller.disputed_transactions += 1
    if body.resolution in ("refund_buyer", "partial_refund"):
        seller.disputes_lost += 1
        seller.commitments_total += 1
        if d.commitment_id and (c := db.get(Commitment, d.commitment_id)):
            c.status = "discrepancy"
    elif d.commitment_id and (c := db.get(Commitment, d.commitment_id)):
        c.status = "fulfilled"
    system_message(db, deal, f"Dispute {d.code} resolved by Accord Support: {body.resolution.replace('_', ' ')}.")
    db.flush()
    d.summary = dispute_summarizer.build(db, d)
    db.commit()
    return dispute_out(d)


_ = os
