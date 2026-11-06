"""Explainable, deterministic trust score. No AI involved."""

from datetime import datetime

from ..models import User, now


def trust_profile(u: User) -> dict:
    years = max(0.0, (now() - u.member_since).days / 365.25) if isinstance(u.member_since, datetime) else 0.0
    total = u.completed_transactions + u.disputed_transactions
    dispute_rate = (u.disputed_transactions / total) if total else 0.0
    rating = (u.rating_sum / u.rating_count) if u.rating_count else 0.0
    kept = (u.commitments_kept / u.commitments_total) if u.commitments_total else None

    parts = [
        ("Verified identity", 15 if u.verified_identity else 0, 15),
        ("Completed transactions", round(min(u.completed_transactions, 50) / 50 * 25), 25),
        ("Dispute history", round(max(0.0, 1 - dispute_rate * 5) * 20) - min(u.disputes_lost * 4, 20) if total else 8, 20),
        ("Account age", round(min(years, 3) / 3 * 15), 15),
        ("Response reliability", round(u.response_rate * 10), 10),
        ("Commitments kept", round(kept * 10) if kept is not None else 4, 10),
        ("Ratings", round(rating / 5 * 5) if u.rating_count else 2, 5),
    ]
    parts = [(n, max(0, s), m) for n, s, m in parts]
    score = sum(s for _, s, _ in parts)

    reasons = []
    if u.verified_identity:
        reasons.append({"ok": True, "text": "Identity verified"})
    else:
        reasons.append({"ok": False, "text": "Identity not verified"})
    reasons.append({"ok": u.completed_transactions >= 5, "text": f"{u.completed_transactions} completed transactions"})
    if u.response_rate:
        reasons.append({"ok": u.response_rate >= 0.85, "text": f"{round(u.response_rate * 100)}% response rate"})
    if total:
        reasons.append({"ok": dispute_rate < 0.05, "text": ("Low" if dispute_rate < 0.05 else "Elevated") + f" dispute rate ({round(dispute_rate * 100, 1)}%)"})
    if kept is not None:
        reasons.append({"ok": kept >= 0.9, "text": f"{u.commitments_kept} of {u.commitments_total} recorded commitments kept"})
    reasons.append({"ok": years >= 1, "text": f"Account active for {years:.1f} years" if years >= 0.1 else "New account"})
    if u.rating_count:
        reasons.append({"ok": rating >= 4.3, "text": f"{rating:.1f}★ average from {u.rating_count} ratings"})

    band = "Highly Trusted" if score >= 85 else "Trusted" if score >= 70 else "Building Trust" if score >= 50 else "Limited History"
    return {
        "score": score,
        "band": band,
        "reasons": reasons,
        "factors": [{"name": n, "points": s, "max": m} for n, s, m in parts],
        "method": "Deterministic weighted score from platform activity. Not AI-generated.",
    }
