import base64
import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .config import get_settings
from .db import get_db
from .models import User

settings = get_settings()
ALGO = "HS256"
REFRESH_COOKIE = "accord_refresh"

# ---------- Passwords (stdlib scrypt, per-user salt, constant-time compare) ----------
_N, _R, _P = 2**14, 8, 1


def hash_password(pw: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(pw.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return f"scrypt${_N}${_R}${_P}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, n, r, p, salt_b64, dk_b64 = stored.split("$")
        dk = hashlib.scrypt(pw.encode(), salt=base64.b64decode(salt_b64), n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(dk, base64.b64decode(dk_b64))
    except Exception:
        return False


_DUMMY_HASH = hash_password(secrets.token_hex(8))


def burn_password_check(pw: str) -> None:
    """Equalize timing for unknown accounts (prevents user enumeration)."""
    verify_password(pw, _DUMMY_HASH)


# ---------- JWT ----------
def _encode(user: User, kind: str, ttl: timedelta) -> str:
    t = datetime.now(UTC)
    return jwt.encode(
        {"sub": user.id, "typ": kind, "ver": user.token_version, "iat": t, "exp": t + ttl, "jti": secrets.token_hex(8)},
        settings.jwt_secret,
        algorithm=ALGO,
    )


def create_access_token(user: User) -> str:
    return _encode(user, "access", timedelta(minutes=settings.access_token_minutes))


def create_refresh_token(user: User) -> str:
    return _encode(user, "refresh", timedelta(days=settings.refresh_token_days))


def decode_token(token: str, kind: str, db: Session) -> User:
    cred_exc = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGO], options={"require": ["exp", "sub", "typ"]})
    except jwt.PyJWTError:
        raise cred_exc from None
    if payload.get("typ") != kind:
        raise cred_exc
    user = db.get(User, payload["sub"])
    if not user or user.token_version != payload.get("ver"):  # logout / password change invalidates
        raise cred_exc
    return user


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return decode_token(auth[7:].strip(), "access", db)


def require_support(user: User = Depends(current_user)) -> User:
    if user.role != "support":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Support role required")
    return user


# ---------- Middleware ----------
class RateLimiter:
    """In-memory sliding-window limiter (per process). Swap for Redis when horizontally scaling."""

    def __init__(self):
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = threading.Lock()

    def allow(self, key: str, limit: int, window: float = 60.0) -> bool:
        t = time.monotonic()
        with self.lock:
            q = self.hits[key]
            while q and t - q[0] > window:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(t)
            if len(self.hits) > 50_000:  # bound memory
                self.hits.clear()
            return True


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    # Only the first hop added by our trusted proxy is used; never trust arbitrary chains.
    fwd = request.headers.get("x-forwarded-for")
    if fwd and settings.is_prod:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method in ("POST", "PUT", "PATCH"):
            cl = request.headers.get("content-length")
            limit = settings.max_upload_bytes + 4096 if "/evidence/file" in path else settings.max_body_bytes
            if cl is None and "chunked" in request.headers.get("transfer-encoding", ""):
                return JSONResponse({"detail": "Length required"}, status_code=411)
            if cl and int(cl) > limit:
                return JSONResponse({"detail": "Payload too large"}, status_code=413)
        if path.startswith("/api/"):
            ip = client_ip(request)
            is_auth = path.startswith("/api/auth/login") or path.startswith("/api/auth/signup")
            if is_auth and not limiter.allow(f"auth:{ip}", settings.auth_rate_limit_per_minute):
                return JSONResponse({"detail": "Too many attempts. Try again shortly."}, status_code=429, headers={"Retry-After": "60"})
            if not limiter.allow(f"api:{ip}", settings.rate_limit_per_minute):
                return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429, headers={"Retry-After": "60"})
        response = await call_next(request)
        h = response.headers
        h["X-Content-Type-Options"] = "nosniff"
        h["X-Frame-Options"] = "DENY"
        h["Referrer-Policy"] = "strict-origin-when-cross-origin"
        h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        h["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; img-src 'self'"
        h["Cross-Origin-Resource-Policy"] = "same-origin"
        if settings.is_prod:
            h["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        if path.startswith("/api/") and "cache-control" not in h:
            h["Cache-Control"] = "no-store"
        return response


def require_csrf_header(request: Request) -> None:
    """Cookie-authenticated endpoints (refresh/logout) require a custom header, which
    cross-site forms cannot send without a CORS preflight."""
    if request.headers.get("x-accord-csrf") != "1":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "CSRF check failed")
