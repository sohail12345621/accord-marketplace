"""Deterministic scam-signal detection. Produces *potential* risk, never a verdict."""

import re

SIGNALS: list[tuple[str, str, int, re.Pattern]] = [
    ("off_platform_payment", "Request to pay outside the platform", 3,
     re.compile(r"\b(don'?t|do not|no need to)\s+(pay|use)\s+(here|on|through|via|the)\b|\b(pay|send|transfer)\b.{0,40}\b(upi|gpay|google pay|phonepe|paytm|bank transfer|neft|imps|crypto|bitcoin|usdt|western union|gift ?card)\b|\bmy (upi|account number|bank account|paytm|gpay)\b", re.I)),
    ("advance_payment", "Upfront / advance payment pressure", 2,
     re.compile(r"\b(advance|token amount|booking amount|deposit|reserve|hold it)\b.{0,40}(₹|rs\.?|inr|\d{3,})|(₹|rs\.?|inr)\s?\d[\d,]*.{0,40}\b(advance|to reserve|to hold|token|first)\b", re.I)),
    ("urgency", "Urgency pressure", 1,
     re.compile(r"\b(right now|immediately|urgent(ly)?|within (the next )?\d+ (min|mins|minutes|hours?)|last chance|many (other )?buyers|someone else is (coming|paying)|today only|asap)\b", re.I)),
    ("contact_migration", "Attempt to move conversation off-platform", 2,
     re.compile(r"\b(whats ?app|telegram|signal app|call me (on|at)|text me (on|at)|my number is|dm me on)\b|(\+?91[\s-]?)?[6-9]\d{9}\b", re.I)),
    ("suspicious_link", "External link", 2,
     re.compile(r"(https?://|www\.)\S+|\b\S+\.(xyz|top|click|link|ru|tk|ly)\b", re.I)),
    ("bypass_safeguards", "Attempt to bypass marketplace safeguards", 2,
     re.compile(r"\b(skip|avoid|bypass)\b.{0,20}\b(escrow|platform|accord|fees?|protection)\b|\b(outside|off) (the )?(platform|app|accord)\b", re.I)),
    ("credential_request", "Request for OTP / credentials", 3,
     re.compile(r"\b(otp|one[- ]time password|pin|cvv|password)\b.{0,30}\b(share|send|tell|give)\b|\b(share|send|tell|give)\b.{0,30}\b(otp|cvv|pin)\b", re.I)),
]


def analyze_risk(text: str, prior_flags: int = 0) -> dict:
    reasons, score, codes = [], 0, []
    for code, label, weight, pat in SIGNALS:
        if pat.search(text):
            reasons.append(label)
            codes.append(code)
            score += weight
    if prior_flags >= 2 and score:
        reasons.append("Repeated attempts in this conversation")
        score += 1
    level = "high" if score >= 4 else "medium" if score >= 2 else "low" if score >= 1 else "none"
    return {"level": level, "score": score, "reasons": reasons, "codes": codes}
