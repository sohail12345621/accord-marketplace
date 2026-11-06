"""Server-side Nexconn Platform Chat API client. The App Secret never leaves this module."""

import hashlib
import hmac
import secrets
import time

import httpx

from ..config import get_settings

BACKUP = {"api.sg-light-api.com": "api-b.sg-light-api.com", "api.us-light-api.com": "api-b.us-light-api.com",
          "api.sau-light-api.com": "api-b.sau-light-api.com"}


class NexconnError(Exception):
    pass


def _signed_headers() -> dict:
    s = get_settings()
    nonce = secrets.token_hex(8)  # <=18 chars
    ts = str(int(time.time() * 1000))
    sig = hashlib.sha1((s.nexconn_app_secret + nonce + ts).encode()).hexdigest()
    return {"App-Key": s.nexconn_app_key, "Nonce": nonce, "Timestamp": ts, "Signature": sig,
            "Content-Type": "application/json", "X-Request-ID": secrets.token_hex(16)}


def issue_access_token(chat_id: str, name: str) -> str:
    s = get_settings()
    if not s.nexconn_enabled:
        raise NexconnError("Nexconn not configured")
    base = s.nexconn_api_base.rstrip("/")
    hosts = [base]
    host = base.split("://")[-1]
    if host in BACKUP:
        hosts.append(base.replace(host, BACKUP[host]))
    last = None
    for h in hosts:  # documented primary → backup domain failover
        try:
            r = httpx.post(f"{h}/v4/auth/access-token/issue", headers=_signed_headers(),
                           json={"userId": chat_id, "name": name[:64]}, timeout=5)
            data = r.json()
            if r.status_code == 200 and data.get("code") == 0:
                return data["result"]["accessToken"]
            last = f"code={data.get('code')}"
        except (httpx.HTTPError, ValueError) as e:
            last = type(e).__name__
    raise NexconnError(f"Token issue failed ({last})")


def verify_webhook(nonce: str, timestamp: str, signature: str) -> bool:
    s = get_settings()
    if not s.nexconn_enabled or not (nonce and timestamp and signature):
        return False
    try:
        if abs(time.time() * 1000 - int(timestamp)) > 5 * 60 * 1000:  # replay window
            return False
    except ValueError:
        return False
    expected = hashlib.sha1((s.nexconn_app_secret + nonce + timestamp).encode()).hexdigest()
    return hmac.compare_digest(expected, signature.lower())
