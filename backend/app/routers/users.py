from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Deal, Dispute, Listing, Message, User
from ..security import current_user
from ..serializers import public_user
from ..services.trust import trust_profile

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/profile/{user_id}")
def get_user_profile(user_id: str, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    t_profile = trust_profile(user)
    listings = db.scalars(
        select(Listing).where(Listing.seller_id == user.id, Listing.status == "active").limit(10)
    ).all()

    return {
        "user": public_user(user, with_trust=False),
        "trust_profile": t_profile,
        "active_listings_count": len(listings),
        "active_listings": [
            {
                "id": l.id,
                "title": l.title,
                "price": l.price,
                "category": l.category,
                "condition": l.condition,
                "image_url": l.image_url,
            }
            for l in listings
        ],
    }


@router.get("/dashboard/overview")
def get_dashboard_overview(user: User = Depends(current_user), db: Session = Depends(get_db)):
    active_deals = db.scalar(
        select(func.count()).select_from(Deal).where(
            ((Deal.buyer_id == user.id) | (Deal.seller_id == user.id))
            & Deal.state.in_(["CONVERSATION_STARTED", "NEGOTIATING", "AGREED", "PAYMENT_PENDING", "PAID", "FULFILLMENT_PENDING", "FULFILLED"])
        )
    ) or 0

    completed_deals = db.scalar(
        select(func.count()).select_from(Deal).where(
            ((Deal.buyer_id == user.id) | (Deal.seller_id == user.id)) & (Deal.state == "COMPLETED")
        )
    ) or 0

    open_disputes = db.scalar(
        select(func.count()).select_from(Dispute).join(Deal, Deal.id == Dispute.deal_id).where(
            ((Deal.buyer_id == user.id) | (Deal.seller_id == user.id)) & (Dispute.status != "resolved")
        )
    ) or 0

    my_listings = db.scalar(
        select(func.count()).select_from(Listing).where(
            Listing.seller_id == user.id, Listing.status == "active"
        )
    ) or 0

    t_profile = trust_profile(user)

    return {
        "metrics": {
            "active_deals": active_deals,
            "completed_deals": completed_deals,
            "open_disputes": open_disputes,
            "active_listings": my_listings,
            "trust_score": t_profile["score"],
            "trust_band": t_profile["band"],
        },
        "trust_profile": t_profile,
    }
