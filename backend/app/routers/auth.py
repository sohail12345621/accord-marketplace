from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import User
from ..security import (
    REFRESH_COOKIE, burn_password_check, create_access_token, create_refresh_token, current_user,
    decode_token, hash_password, require_csrf_header, verify_password,
)
from ..serializers import me_user

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


class SignupIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=60)
    password: str = Field(min_length=10, max_length=128)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if any(c in v for c in "<>{}\\"):
            raise ValueError("Name contains invalid characters")
        return v

    @field_validator("password")
    @classmethod
    def strong(cls, v: str) -> str:
        if v.isalpha() or v.isdigit() or v.lower() == v and v.isalnum():
            raise ValueError("Use at least 10 characters mixing letters, numbers or symbols")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


def _session(resp: Response, user: User) -> dict:
    resp.set_cookie(REFRESH_COOKIE, create_refresh_token(user), httponly=True, secure=settings.is_prod,
                    samesite="strict", max_age=settings.refresh_token_days * 86400, path="/api/auth")
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": me_user(user)}


@router.post("/signup", status_code=201)
def signup(body: SignupIn, resp: Response, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists")
    user = User(email=email, name=body.name, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    return _session(resp, user)


@router.post("/login")
def login(body: LoginIn, resp: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user:
        burn_password_check(body.password)
        raise HTTPException(401, "Invalid email or password")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return _session(resp, user)


@router.post("/refresh", dependencies=[Depends(require_csrf_header)])
def refresh(request: Request, resp: Response, db: Session = Depends(get_db)):
    tok = request.cookies.get(REFRESH_COOKIE)
    if not tok:
        raise HTTPException(401, "Not authenticated")
    user = decode_token(tok, "refresh", db)
    return _session(resp, user)  # rotate refresh cookie


@router.post("/logout", dependencies=[Depends(require_csrf_header)])
def logout(resp: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.token_version += 1  # invalidates every outstanding access + refresh token
    db.commit()
    resp.delete_cookie(REFRESH_COOKIE, path="/api/auth")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return me_user(user)
