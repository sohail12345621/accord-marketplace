"""CommitmentExtractor: turns transaction-relevant statements into structured commitments.

Deterministic rules always run; an LLM (if configured) may add items, but every LLM item must
quote text that literally exists in the message — otherwise it is discarded (no fabrication)."""

import re

from .ai import ai

ALLOWED_TYPES = {"PRODUCT_ATTRIBUTE", "INCLUDED_ITEM", "FULFILLMENT", "PRICE", "CONDITION", "WARRANTY"}
HEDGES = re.compile(r"\b(i think|maybe|probably|around|approx(imately)?|roughly|should be|might|not sure|i guess)\b", re.I)
INCLUDE_CTX = re.compile(r"\b(includ\w*|comes with|com\w* with|along with|will give|i'?ll give|giving|throw in|with (the )?(original|box|bill))\b", re.I)
NOT_INCLUDED = re.compile(r"\b(no|without|not included|doesn'?t come with|don'?t have|missing)\b", re.I)
ITEMS = {
    "charger": "Original charger", "box": "Original box", "bill": "Purchase bill / invoice", "invoice": "Purchase bill / invoice",
    "cable": "Charging cable", "case": "Case / cover", "earphones": "Earphones", "adapter": "Power adapter",
    "controller": "Controller", "lens cap": "Lens cap", "strap": "Strap", "battery grip": "Battery grip",
    "sd card": "Memory card", "mouse": "Mouse", "keyboard": "Keyboard",
}
MONEY = r"(?:₹|rs\.?|inr)\s?(\d{1,3}(?:,\d{2,3})+|\d{4,7})k?|(\d{2,3})\s?k\b"
DATE_WORDS = r"(today|tomorrow|tonight|day after tomorrow|this (?:week|weekend)|(?:on |by )?(?:mon|tues|wednes|thurs|fri|satur|sun)day|(?:on |by )?\d{1,2}(?:st|nd|rd|th)? (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(?:on |by )?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}|within \d+ (?:days?|hours?))"


def _sentences(text: str) -> list[str]:
    # Split on periods, exclamation marks, question marks, commas, newlines, or semicolons
    return [s.strip() for s in re.split(r"[.!?;,\n]+", text) if s.strip()]


def _money(s: str) -> int | None:
    m = re.search(MONEY, s, re.I)
    if not m:
        return None
    if m.group(1):
        return int(m.group(1).replace(",", ""))
    return int(m.group(2)) * 1000


def _rules(text: str) -> list[dict]:
    out: list[dict] = []

    def add(t, attr, label, value, quote, conf=0.95):
        if HEDGES.search(quote):
            conf = min(conf, 0.7)
        out.append({"type": t, "attribute": attr, "label": label, "value": value, "confidence": conf, "quote": quote})

    for s in _sentences(text):
        if s.endswith("?"):
            continue  # questions are not commitments
        low = s.lower()
        if m := re.search(r"battery(?: health)?(?: is| at| of|:| -)?\s*(?:still\s*)?(\d{2,3})\s*%", low):
            add("PRODUCT_ATTRIBUTE", "battery_health", "Battery Health", f"{m.group(1)}%", s)
        if m := re.search(r"(?:cycle count|battery cycles?)(?: is|:| of)?\s*(\d{1,4})", low):
            add("PRODUCT_ATTRIBUTE", "battery_cycles", "Battery Cycle Count", m.group(1), s)
        if m := re.search(r"shutter count(?: is|:| of)?\s*(?:around\s*|only\s*)?(\d[\d,]*)", low):
            add("PRODUCT_ATTRIBUTE", "shutter_count", "Shutter Count", m.group(1), s)
        if m := re.search(r"(\d{2,4})\s?(gb|tb)\s*(?:of\s*)?(storage|ssd|variant|model|internal)", low):
            add("PRODUCT_ATTRIBUTE", "storage", "Storage", f"{m.group(1)} {m.group(2).upper()}", s)
        if m := re.search(r"(\d{1,3})\s?gb\s*(?:of\s*)?(ram|memory|vram|gddr\d?x?)", low):
            attr = "vram" if m.group(2).startswith(("vram", "gddr")) else "ram"
            add("PRODUCT_ATTRIBUTE", attr, "VRAM" if attr == "vram" else "RAM", f"{m.group(1)} GB", s)
        if re.search(r"\b(no|zero|never had any|never had)\s+(previous |prior )?(repairs?|repair work)\b|\bnever (been )?(repaired|opened)\b|\bnot (been )?(repaired|opened)\b", low):
            add("PRODUCT_ATTRIBUTE", "repair_history", "Repair History", "No previous repairs", s)
        elif m := re.search(r"\b(screen|battery|display|back glass|motherboard|fan)\s+(was |has been )?(replaced|repaired)\b", low):
            add("PRODUCT_ATTRIBUTE", "repair_history", "Repair History", f"{m.group(1).capitalize()} {m.group(3)}", s)
        if re.search(r"\b(no|zero|not a single)\s+(scratch(es)?|dents?|marks)\b|\bscratch[- ]?less\b|\bflawless\b", low):
            add("CONDITION", "cosmetic_condition", "Cosmetic Condition", "No scratches or dents", s, 0.9)
        if re.search(r"\b(never (been )?mined|not used for mining|no mining)\b", low):
            add("PRODUCT_ATTRIBUTE", "mining_history", "Mining History", "Never used for mining", s)
        if m := re.search(r"warranty\s*(?:is\s*)?(?:valid\s*)?(?:till|until|up ?to|through)\s+([a-z]+\s?\d{0,4}|\d{1,2}\s?[a-z]+\s?\d{0,4})", low):
            add("WARRANTY", "warranty", "Warranty", f"Valid until {m.group(1).strip().title()}", s)
        elif m := re.search(r"(\d{1,2})\s*months?\s*(?:of\s*)?(?:brand\s*|apple\s*|manufacturer\s*)?warranty", low):
            add("WARRANTY", "warranty", "Warranty", f"{m.group(1)} months remaining", s)
        if INCLUDE_CTX.search(low) and not NOT_INCLUDED.search(low):
            for key, label in ITEMS.items():
                if re.search(rf"\b{key}s?\b", low):
                    attr = ("original_" if "original" in low and key in ("charger", "box") else "") + key.replace(" ", "_")
                    add("INCLUDED_ITEM", attr, "Included Item", label, s, 0.93)
        if m := re.search(rf"\b(ship|dispatch|deliver|courier|send)\w*\b(?: it| the \w+)?(?: out)?\s+(?:by\s+)?{DATE_WORDS}", low):
            add("FULFILLMENT", "shipping_date", "Ship By", m.group(2).replace("on ", "").replace("by ", "").strip().title(), s, 0.92)
        elif m := re.search(rf"\b(pick ?up|meet|collect)\w*\b.{{0,30}}?{DATE_WORDS}", low):
            add("FULFILLMENT", "pickup_date", "Pickup", m.group(2).replace("on ", "").replace("by ", "").strip().title(), s, 0.85)
        if re.search(r"\b(final|agreed|deal at|deal for|done at|done for|i'?ll pay|i can pay|let'?s do|ok(ay)? at|accept)\b", low) and (amt := _money(s)):
            add("PRICE", "agreed_price", "Agreed Price", f"₹{amt:,}", s, 0.8)
    return out


def extract_commitments(text: str, speaker: str, listing_ctx: dict) -> list[dict]:
    found = _rules(text)
    seen = {c["attribute"] for c in found}
    llm = ai.complete_json(
        task=f"Extract only explicit, transaction-relevant commitments made by the {speaker} in the message. "
        "Ignore questions, small talk, and vague statements. Each item must include an exact quote copied from the message.",
        schema='{"commitments":[{"type":"PRODUCT_ATTRIBUTE|INCLUDED_ITEM|FULFILLMENT|PRICE|CONDITION|WARRANTY",'
        '"attribute":"snake_case","label":"Title Case","value":"string","confidence":0.0,"quote":"exact substring"}]}',
        app_data={"speaker_role": speaker, "listing": listing_ctx},
        untrusted=text,
    )
    if llm and isinstance(llm.get("commitments"), list):
        for c in llm["commitments"][:8]:
            try:
                quote, typ, attr = str(c["quote"]), str(c["type"]), re.sub(r"[^a-z0-9_]", "", str(c["attribute"]).lower())[:48]
                conf = float(c.get("confidence", 0))
            except (KeyError, TypeError, ValueError):
                continue
            if typ not in ALLOWED_TYPES or not attr or attr in seen or len(quote) < 4 or quote.lower() not in text.lower():
                continue  # anti-hallucination: evidence must literally exist
            found.append({"type": typ, "attribute": attr, "label": str(c.get("label") or attr.replace("_", " ").title())[:80],
                          "value": str(c.get("value", ""))[:200], "confidence": max(0.0, min(conf, 0.95)), "quote": quote[:500]})
            seen.add(attr)
    # dedupe same attribute within one message (keep highest confidence)
    best: dict[str, dict] = {}
    for c in found:
        key = c["attribute"] + ("" if c["type"] != "INCLUDED_ITEM" else c["value"])
        if key not in best or c["confidence"] > best[key]["confidence"]:
            best[key] = c
    return list(best.values())


def numeric(v: str | None) -> float | None:
    if not v:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", v.replace(",", ""))
    return float(m.group()) if m else None


def values_conflict(a: str, b: str) -> bool:
    na, nb = numeric(a), numeric(b)
    if na is not None and nb is not None:
        return abs(na - nb) > 1e-6
    return a.strip().lower() != b.strip().lower()
