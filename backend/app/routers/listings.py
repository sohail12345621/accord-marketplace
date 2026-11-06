from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, HttpUrl, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Deal, Listing, User, now
from ..security import current_user
from ..serializers import deal_brief, listing_out
from ..services.assistants import listing_assistant
from ..services.deals import new_code

router = APIRouter(prefix="/api", tags=["listings"])
CATEGORIES = ["Smartphones", "Laptops", "GPUs", "Gaming", "Cameras", "Accessories"]
CONDITIONS = ["Like New", "Excellent", "Good", "Fair"]


def _clean(v: str) -> str:
    return " ".join(v.replace("<", "").replace(">", "").split())


class ListingIn(BaseModel):
    title: str = Field(min_length=5, max_length=140)
    category: Literal["Smartphones", "Laptops", "GPUs", "Gaming", "Cameras", "Accessories"]
    price: int = Field(gt=0, le=10_000_000)
    condition: Literal["Like New", "Excellent", "Good", "Fair"]
    location: str = Field(min_length=2, max_length=80)
    image_url: HttpUrl | None = None
    description: str = Field(default="", max_length=3000)
    specs: dict[str, str] = Field(default_factory=dict)

    _c = field_validator("title", "location")(lambda cls, v: _clean(v))

    @field_validator("specs")
    @classmethod
    def specs_ok(cls, v: dict) -> dict:
        return _clean_specs(v)


def _clean_specs(v: dict) -> dict:
    if len(v) > 20:
        raise ValueError("Too many specs")
    return {_clean(k)[:40]: _clean(str(val))[:120] for k, val in v.items() if k.strip()}


class ListingPatch(BaseModel):
    title: str | None = Field(default=None, min_length=5, max_length=140)
    price: int | None = Field(default=None, gt=0, le=10_000_000)
    condition: Literal["Like New", "Excellent", "Good", "Fair"] | None = None
    description: str | None = Field(default=None, max_length=3000)
    specs: dict[str, str] | None = None
    status: Literal["active", "sold", "paused"] | None = None


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=300)


@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    counts = dict(db.execute(select(Listing.category, func.count()).where(Listing.status == "active").group_by(Listing.category)).all())
    return [{"name": c, "count": counts.get(c, 0)} for c in CATEGORIES]


@router.get("/listings")
def list_listings(
    db: Session = Depends(get_db),
    q: str | None = Query(None, max_length=80),
    category: str | None = Query(None, max_length=32),
    condition: str | None = Query(None, max_length=32),
    min_price: int | None = Query(None, ge=0),
    max_price: int | None = Query(None, ge=0),
    seller_id: str | None = Query(None, max_length=32),
    sort: Literal["newest", "price_asc", "price_desc"] = "newest",
    limit: int = Query(24, ge=1, le=60),
    offset: int = Query(0, ge=0, le=10_000),
):
    stmt = select(Listing).where(Listing.status == "active")
    if q:
        like = f"%{q.strip()}%"  # bound parameter — never string-built SQL
        stmt = stmt.where(or_(Listing.title.ilike(like), Listing.description.ilike(like)))
    if category:
        stmt = stmt.where(Listing.category == category)
    if condition:
        stmt = stmt.where(Listing.condition == condition)
    if min_price is not None:
        stmt = stmt.where(Listing.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Listing.price <= max_price)
    if seller_id:
        stmt = stmt.where(Listing.seller_id == seller_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    order = {"newest": Listing.created_at.desc(), "price_asc": Listing.price.asc(), "price_desc": Listing.price.desc()}[sort]
    items = db.scalars(stmt.order_by(order).limit(limit).offset(offset)).unique().all()
    return {"total": total, "items": [listing_out(x) for x in items]}


@router.get("/listings/{listing_id}")
def get_listing(listing_id: str, db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if not listing or listing.status == "removed":
        raise HTTPException(404, "Listing not found")
    listing.views += 1
    db.commit()
    return listing_out(listing, full=True)


@router.post("/listings", status_code=201)
def create_listing(body: ListingIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    recent = db.scalar(select(func.count()).select_from(Listing).where(Listing.seller_id == user.id, Listing.created_at > now().replace(hour=0, minute=0)))
    if recent >= 20:
        raise HTTPException(429, "Daily listing limit reached")  # anti-spam / fake listings
    listing = Listing(seller_id=user.id, title=body.title, category=body.category, price=body.price, condition=body.condition,
                      location=body.location, image_url=str(body.image_url) if body.image_url else "",
                      description=body.description, specs=body.specs,
                      history=[{"at": now().isoformat() + "Z", "event": f"Listed at ₹{body.price:,}"}])
    db.add(listing)
    db.commit()
    return listing_out(listing, full=True)


@router.patch("/listings/{listing_id}")
def update_listing(listing_id: str, body: ListingPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if not listing or listing.seller_id != user.id:  # ownership enforced server-side
        raise HTTPException(404, "Listing not found")
    data = body.model_dump(exclude_unset=True)
    hist = list(listing.history or [])
    if "price" in data and data["price"] != listing.price:
        hist.append({"at": now().isoformat() + "Z", "event": f"Price changed ₹{listing.price:,} → ₹{data['price']:,}"})
    if "specs" in data:
        if len(data["specs"] or {}) > 20:
            raise HTTPException(422, "Too many specs")
        data["specs"] = _clean_specs(data["specs"] or {})
        hist.append({"at": now().isoformat() + "Z", "event": "Specifications updated"})
    for k, v in data.items():
        setattr(listing, k, _clean(v) if k == "title" else v)
    listing.history = hist
    db.commit()
    return listing_out(listing, full=True)


@router.post("/listings/{listing_id}/ask")
def ask_accord(listing_id: str, body: AskIn, _: User = Depends(current_user), db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    return listing_assistant.answer(db, listing, body.question)


@router.post("/listings/{listing_id}/conversation")
def start_conversation(listing_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if not listing or listing.status != "active":
        raise HTTPException(404, "Listing not available")
    if listing.seller_id == user.id:
        raise HTTPException(400, "You cannot start a conversation on your own listing")
    deal = db.scalar(select(Deal).where(Deal.listing_id == listing.id, Deal.buyer_id == user.id))
    if not deal:
        deal = Deal(code=new_code("AC"), listing_id=listing.id, buyer_id=user.id, seller_id=listing.seller_id)
        db.add(deal)
        db.commit()
    return deal_brief(deal, user)
