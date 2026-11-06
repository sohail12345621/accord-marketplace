"""Grounded assistants. Each builds a deterministic answer from application data; the LLM (if enabled)
may only rephrase/expand using the same data. Output always marks what is AI-generated."""

import re
import statistics
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Commitment, Deal, Dispute, Evidence, Listing, Message
from .ai import ai
from .commitments import numeric, values_conflict
from .trust import trust_profile

NO_EVIDENCE = "I don't have enough evidence to determine that."

EXPECTED_SPECS = {
    "Smartphones": ["Battery Health", "Storage", "RAM", "Repair History", "Warranty", "Included Accessories", "IMEI Status"],
    "Laptops": ["Processor", "RAM", "Storage", "Battery Cycles", "Repair History", "Warranty", "Included Accessories"],
    "GPUs": ["VRAM", "Mining History", "Warranty", "Max Temperature", "Repair History", "Included Accessories"],
    "Gaming": ["Storage", "Controllers", "Warranty", "Repair History", "Included Accessories"],
    "Cameras": ["Shutter Count", "Lens", "Sensor Condition", "Warranty", "Included Accessories"],
    "Accessories": ["Compatibility", "Warranty", "Included Accessories"],
}
CATEGORY_RISKS = {
    "Smartphones": ["Verify battery health in Settings → Battery yourself", "Check IMEI against the bill and *#06#", "Confirm iCloud / Google account is signed out", "Test Face ID / fingerprint, cameras and speakers"],
    "Laptops": ["Check battery cycle count and health report", "Confirm BIOS / Activation lock is removed", "Run a keyboard, display and port check", "Match serial number with the invoice"],
    "GPUs": ["Ask for a stress-test video (temps under load)", "Check for signs of mining use (yellowed thermal pads, fan wear)", "Confirm warranty transfer with the brand", "Inspect PCB and connectors for damage"],
    "Gaming": ["Confirm console is not banned / account removed", "Test all controllers and drift", "Check disc drive if applicable"],
    "Cameras": ["Verify shutter count with a test shot file", "Inspect sensor and lens for fungus, haze or scratches", "Confirm serial number matches the bill"],
    "Accessories": ["Confirm compatibility with your device", "Ask for the original bill for warranty claims"],
}
QUESTION_FOR = {
    "Battery Health": "What is the current battery health percentage? Could you share a screenshot?",
    "Battery Cycles": "What is the battery cycle count?",
    "Repair History": "Has the device ever been repaired or opened?",
    "Warranty": "Is any warranty remaining, and do you have the bill?",
    "Included Accessories": "Which accessories are included (charger, box, bill)?",
    "IMEI Status": "Can you confirm the IMEI is clean and matches the bill?",
    "Mining History": "Was the card ever used for mining?",
    "Max Temperature": "What temperatures does it reach under full load?",
    "Shutter Count": "What is the current shutter count?",
    "Sensor Condition": "Any dust, fungus or scratches on the sensor or lens?",
    "Controllers": "How many controllers are included, and any stick drift?",
}


def _has_spec(listing: Listing, name: str) -> bool:
    return any(k.lower() == name.lower() for k in (listing.specs or {}))


def comparables(db: Session, listing: Listing) -> dict:
    prices = [p for (p,) in db.execute(
        select(Listing.price).where(Listing.category == listing.category, Listing.id != listing.id, Listing.status == "active").limit(200)
    )]
    if len(prices) < 2:
        return {"count": len(prices)}
    return {"count": len(prices), "median": int(statistics.median(prices)), "min": min(prices), "max": max(prices)}


def listing_context(listing: Listing) -> dict:
    return {"title": listing.title, "category": listing.category, "price_inr": listing.price, "condition": listing.condition,
            "specs": listing.specs, "description": listing.description[:1500], "location_city": listing.location}


class ListingAssistant:
    INTENTS = {
        "price": re.compile(r"price|worth|reasonable|fair|expensive|cheap|overpriced|deal", re.I),
        "ask": re.compile(r"ask|question", re.I),
        "risk": re.compile(r"risk|scam|safe|check|careful|inspect", re.I),
        "missing": re.compile(r"missing|spec|info|detail", re.I),
    }

    def answer(self, db: Session, listing: Listing, question: str) -> dict:
        intent = next((k for k, p in self.INTENTS.items() if p.search(question)), None)
        missing = [s for s in EXPECTED_SPECS.get(listing.category, []) if not _has_spec(listing, s)]
        comp = comparables(db, listing)
        trust = trust_profile(listing.seller)
        facts: list[str] = []
        sources: list[str] = []
        if intent == "price":
            if comp.get("median"):
                diff = (listing.price - comp["median"]) / comp["median"] * 100
                pos = "below" if diff < -3 else "above" if diff > 3 else "in line with"
                facts.append(f"₹{listing.price:,} is {abs(diff):.0f}% {pos} the median of {comp['count']} active {listing.category} listings on Accord (₹{comp['median']:,})." if pos != "in line with" else f"₹{listing.price:,} is in line with the median of {comp['count']} active {listing.category} listings (₹{comp['median']:,}).")
                facts.append(f"Range across those listings: ₹{comp['min']:,} – ₹{comp['max']:,}. Note: they are different models, so this is only a rough signal.")
                sources.append(f"{comp['count']} comparable Accord listings")
            else:
                facts.append(NO_EVIDENCE + " There are too few comparable listings.")
            if missing:
                facts.append(f"Price fairness also depends on details not stated: {', '.join(missing[:4])}.")
        elif intent == "ask" or intent is None:
            qs = [QUESTION_FOR.get(m, f"Can you confirm the {m.lower()}?") for m in missing][:5]
            facts += qs or ["The listing covers the key specifications. Ask the seller to confirm them in chat so they enter the Deal Ledger."]
            facts.append("Tip: answers given in chat are captured as commitments in your Deal Ledger.")
        elif intent == "risk":
            facts += CATEGORY_RISKS.get(listing.category, [])
            if trust["score"] < 60:
                facts.append(f"The seller's trust score is {trust['score']}/100 ({trust['band']}). Prefer Accord escrow and in-person inspection.")
            facts.append("Never pay outside Accord or share OTPs — escrow protection only applies to on-platform payments.")
            sources.append("Seller trust profile")
        elif intent == "missing":
            facts += [f"Not stated: {m}" for m in missing] or ["All specifications Accord expects for this category are listed."]
        sources.insert(0, "Listing data")
        result = {"intent": intent or "ask", "points": facts, "sources": sources, "ai_generated": False}
        llm = ai.complete_json(
            task="Answer the buyer's question about this listing in <=90 words using only application_data. "
            "If facts are insufficient, say so explicitly.",
            schema='{"answer":"string"}',
            app_data={"listing": listing_context(listing), "comparables": comp, "missing_specs": missing,
                      "seller_trust_score": trust["score"], "computed_points": facts},
            untrusted=question,
        )
        if llm and isinstance(llm.get("answer"), str):
            result["ai_summary"] = llm["answer"][:800]
            result["ai_generated"] = True
        return result


class NegotiationAssistant:
    def suggest(self, db: Session, deal: Deal, commitments: list[Commitment]) -> dict:
        listing = deal.listing
        have = {c.attribute for c in commitments if c.status in ("active", "pending", "fulfilled")}
        wanted = {"Smartphones": ["battery_health", "repair_history", "original_charger"], "Laptops": ["battery_cycles", "repair_history", "charger"],
                  "GPUs": ["mining_history", "warranty"], "Cameras": ["shutter_count", "warranty"], "Gaming": ["controller", "warranty"],
                  "Accessories": ["warranty"]}.get(listing.category, [])
        gaps = [w for w in wanted if w not in have]
        comp = comparables(db, listing)
        tips = [f"Ask the seller to confirm {g.replace('_', ' ')} in writing — it will be recorded in the Deal Ledger." for g in gaps]
        if "shipping_date" not in have and "pickup_date" not in have:
            tips.append("Agree on a ship-by or pickup date so fulfilment can be tracked.")
        if comp.get("median") and listing.price > comp["median"]:
            tips.append(f"Listing is above the category median (₹{comp['median']:,}); a modest counter-offer is reasonable.")
        return {"gaps": gaps, "tips": tips[:5], "ai_generated": False}


SUPPORT_PATTERNS = {
    "not_shipped": re.compile(r"(hasn'?t|has not|didn'?t|did not|not yet|still not|never)\s+(been\s+)?(ship|sent|dispatch|deliver)|where is my (order|item)|not (received|delivered)", re.I),
    "not_as_described": re.compile(r"not as described|wrong item|different (from|than)|doesn'?t match|missing|broken|damaged|fake", re.I),
    "refund": re.compile(r"refund|money back|cancel", re.I),
}


class SupportAssistant:
    def analyze(self, deal: Deal, text: str, role: str, extracted: list[dict], commitments: list[Commitment]) -> dict | None:
        if role != "buyer":
            return None
        active = [c for c in commitments if c.party == "seller" and c.status in ("active", "discrepancy")]
        # 1) Conflicting value vs an existing seller commitment → discrepancy card
        for e in extracted:
            for c in active:
                if c.attribute == e["attribute"] and values_conflict(c.value, e["value"]):
                    return {"kind": "discrepancy", "title": "Commitment discrepancy detected",
                            "commitment_id": c.id, "label": c.label, "committed": c.value, "reported": e["value"],
                            "source_quote": c.source_text,
                            "actions": ["record_reported_value", "open_dispute", "message_seller"]}
        if SUPPORT_PATTERNS["not_shipped"].search(text):
            ship = next((c for c in active if c.attribute in ("shipping_date", "pickup_date")), None)
            overdue = bool(ship and ship.due_at and ship.due_at < datetime.now())
            shipped = deal.state in ("FULFILLED", "COMPLETED")
            return {"kind": "shipment", "title": ("Shipment commitment appears overdue" if overdue else "Shipment status check") if not shipped else "Order marked as shipped",
                    "commitment_id": ship.id if ship else None,
                    "committed": f"{ship.label}: {ship.value}" if ship else "No ship-by date was committed in this conversation",
                    "current": "Shipped / handed over" if shipped else "Not shipped" if deal.state in ("PAID", "FULFILLMENT_PENDING") else deal.state.replace("_", " ").title(),
                    "actions": ["message_seller", "open_dispute", "request_cancellation"] if deal.state in ("PAID", "FULFILLMENT_PENDING") else ["message_seller", "open_support"]}
        if SUPPORT_PATTERNS["not_as_described"].search(text) and deal.state in ("PAID", "FULFILLMENT_PENDING", "FULFILLED", "COMPLETED"):
            return {"kind": "not_as_described", "title": "Item may not match what was promised",
                    "committed": f"{len(active)} seller commitments on record", "current": deal.state.replace("_", " ").title(),
                    "actions": ["open_dispute", "message_seller"]}
        return None


class DisputeSummarizer:
    def build(self, db: Session, dispute: Dispute) -> dict:
        deal = dispute.deal
        listing = deal.listing
        commit = db.get(Commitment, dispute.commitment_id) if dispute.commitment_id else None
        src_msg = db.get(Message, commit.message_id) if commit and commit.message_id else None
        evidence = list(db.scalars(select(Evidence).where(Evidence.dispute_id == dispute.id).order_by(Evidence.created_at)))
        flagged = db.scalar(select(Message.id).where(Message.deal_id == deal.id, Message.risk_level == "high").limit(1))
        spec_match = None
        if commit:
            for k, v in (listing.specs or {}).items():
                if k.lower().replace(" ", "_") == commit.attribute or k.lower() == commit.label.lower():
                    spec_match = {"spec": k, "value": v}
        facts = {
            "issue": dispute.issue,
            "listing": {"title": listing.title, "listed_price": listing.price},
            "agreed_price": deal.agreed_price,
            "deal_code": deal.code,
            "commitment": {"label": commit.label, "seller_stated": commit.value, "status": commit.status} if commit else None,
            "reported_value": dispute.reported_value or (commit.reported_value if commit else None),
            "source_message": {"text": src_msg.body, "sent_at": src_msg.sent_at.isoformat()} if src_msg else None,
            "listing_spec": spec_match,
            "evidence": [{"role": e.role, "kind": e.kind, "at": e.created_at.isoformat(), "file": e.file_name, "text": e.text[:300]} for e in evidence],
        }
        ev_list = []
        if src_msg:
            ev_list.append("Original seller message (chat record)")
        if spec_match:
            ev_list.append(f"Listing specification: {spec_match['spec']} = {spec_match['value']}")
        ev_list += [f"{e.role.title()} {'uploaded file' if e.kind == 'file' else 'statement'}" + (f": {e.file_name}" if e.file_name else "") for e in evidence if e.role != "support"]
        has_seller = any(e.role == "seller" for e in evidence)
        has_buyer_file = any(e.role == "buyer" and e.kind == "file" for e in evidence)
        if dispute.status == "resolved":
            nxt = "Case closed. No further action."
        elif not has_seller:
            nxt = "Request seller response"
        elif commit and not has_buyer_file:
            nxt = "Request buyer evidence (e.g. screenshot of the reported value)"
        else:
            nxt = "Support review: compare buyer and seller evidence against the recorded commitment"
        gaps = []
        if not src_msg and commit:
            gaps.append("No source chat message linked to this commitment.")
        if not facts["reported_value"]:
            gaps.append("No reported/verified value recorded yet.")
        if not has_seller:
            gaps.append("Seller has not responded yet.")
        summary = {"facts": facts, "evidence_list": ev_list, "suggested_next_action": nxt, "evidence_gaps": gaps,
                   "risk_flags": ["High-risk message detected earlier in this conversation"] if flagged else [],
                   "ai_generated": False,
                   "assessment": self._deterministic_assessment(commit, facts["reported_value"], has_seller)}
        llm = ai.complete_json(
            task="Write a neutral 2-4 sentence case assessment for a human support agent using only application_data. "
            "Do not decide the outcome or accuse anyone. Mention missing evidence.",
            schema='{"assessment":"string"}', app_data=facts,
            untrusted="\n".join(e.text[:300] for e in evidence),
        )
        if llm and isinstance(llm.get("assessment"), str):
            summary["assessment"] = llm["assessment"][:1200]
            summary["ai_generated"] = True
        return summary

    @staticmethod
    def _deterministic_assessment(commit, reported, has_seller) -> str:
        if not commit:
            return "This dispute is not linked to a specific recorded commitment. " + NO_EVIDENCE + " Review the conversation and evidence."
        if not reported:
            return f"The seller committed to {commit.label}: {commit.value}. No conflicting value has been recorded yet. " + NO_EVIDENCE
        a, b = numeric(commit.value), numeric(reported)
        gap = f" (a difference of {abs(a - b):g} points)" if a is not None and b is not None else ""
        return (f"The recorded seller commitment states {commit.label}: {commit.value}; the buyer reports {reported}{gap}. "
                f"The commitment is backed by the original chat message. "
                + ("The seller has responded; compare both parties' evidence." if has_seller else "The seller has not yet responded.")
                + " A human agent should make the final decision.")


listing_assistant = ListingAssistant()
negotiation_assistant = NegotiationAssistant()
support_assistant = SupportAssistant()
dispute_summarizer = DisputeSummarizer()
