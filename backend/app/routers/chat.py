import json
import logging
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Deal, User
from ..security import current_user
from ..services.deals import ingest_message
from ..services.nexconn import NexconnError, issue_access_token, verify_webhook

router = APIRouter(prefix="/api/chat", tags=["chat"])
settings = get_settings()
log = logging.getLogger("accord.nexconn")


@router.get("/token")
def get_chat_token(user: User = Depends(current_user)):
    """Issues a short-lived user-specific Nexconn access token.
    Crucially: NEXCONN_APP_SECRET is used ONLY on the backend to sign this request.
    The secret is never revealed to the frontend.
    """
    nexconn_uid = user.chat_id or f"accord_{user.id}"
    if not settings.nexconn_enabled:
        return {
            "enabled": False,
            "user_id": nexconn_uid,
            "userId": nexconn_uid,
            "name": user.name,
            "app_key": settings.nexconn_app_key or "",
            "appKey": settings.nexconn_app_key or "",
            "area": settings.nexconn_area,
            "mode": "fallback_local",
            "message": "Nexconn credentials not configured on server; running local transport fallback.",
        }
    try:
        token = issue_access_token(nexconn_uid, user.name)
        return {
            "enabled": True,
            "app_key": settings.nexconn_app_key,
            "appKey": settings.nexconn_app_key,
            "token": token,
            "user_id": nexconn_uid,
            "userId": nexconn_uid,
            "name": user.name,
            "area": settings.nexconn_area,
            "mode": "nexconn_live",
        }
    except NexconnError as e:
        log.warning("Nexconn token generation failed: %s", e)
        return {
            "enabled": False,
            "user_id": nexconn_uid,
            "userId": nexconn_uid,
            "name": user.name,
            "app_key": settings.nexconn_app_key or "",
            "appKey": settings.nexconn_app_key or "",
            "area": settings.nexconn_area,
            "mode": "fallback_local",
            "error": "Failed to issue Nexconn token; falling back to local transport.",
        }


@router.post("/webhook")
async def nexconn_webhook(
    request: Request,
    nonce: str | None = Header(None, alias="Nonce"),
    timestamp: str | None = Header(None, alias="Timestamp"),
    signature: str | None = Header(None, alias="Signature"),
    db: Session = Depends(get_db),
):
    """Server-side webhook receiving message:send events from Nexconn.
    Verifies SHA1 signature using App Secret + Nonce + Timestamp.
    Ingests messages into Deal Ledger & triggers commitment extraction.
    """
    if not verify_webhook(nonce or "", timestamp or "", signature or ""):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    body_bytes = await request.body()
    try:
        payload = json.loads(body_bytes.decode())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if payload.get("type") != "message:send":
        return {"status": "ignored"}

    for item in payload.get("data", []):
        sender_chat_id = item.get("userId")
        target_chat_id = item.get("channelId")
        msg_id = item.get("messageId")
        content_raw = item.get("content", "")

        # Unpack Nexconn text content JSON if present
        text_body = ""
        try:
            content_json = json.loads(content_raw) if isinstance(content_raw, str) else content_raw
            text_body = content_json.get("content") or content_json.get("text") or str(content_raw)
        except Exception:
            text_body = str(content_raw)

        if not text_body or not sender_chat_id or not target_chat_id:
            continue

        sender = db.scalar(
            select(User).where(
                (User.chat_id == sender_chat_id)
                | (User.id == sender_chat_id)
                | (User.id == sender_chat_id.replace("accord_", ""))
            )
        )
        counterpart = db.scalar(
            select(User).where(
                (User.chat_id == target_chat_id)
                | (User.id == target_chat_id)
                | (User.id == target_chat_id.replace("accord_", ""))
            )
        )
        if not sender or not counterpart:
            continue

        # Locate the direct channel deal between these two users
        deal = db.scalar(
            select(Deal).where(
                ((Deal.buyer_id == sender.id) & (Deal.seller_id == counterpart.id))
                | ((Deal.buyer_id == counterpart.id) & (Deal.seller_id == sender.id))
            ).order_by(Deal.last_message_at.desc())
        )
        if deal:
            try:
                ingest_message(db, deal, sender, text_body, msg_id, transport="nexconn")
            except Exception as ex:
                log.error("Webhook message ingestion failed: %s", ex)

    return {"status": "processed"}
