"""Backend-enforced transaction state machine. Clients can only *request* transitions."""

from fastapi import HTTPException

STATES = [
    "LISTED", "CONVERSATION_STARTED", "NEGOTIATING", "AGREED", "PAYMENT_PENDING", "PAID",
    "FULFILLMENT_PENDING", "FULFILLED", "COMPLETED", "DISPUTED", "CANCELLED", "RESOLVED",
]

# (from, to) -> roles allowed to request it. "system" transitions are performed internally.
TRANSITIONS: dict[tuple[str, str], set[str]] = {
    ("CONVERSATION_STARTED", "NEGOTIATING"): {"system"},
    ("CONVERSATION_STARTED", "AGREED"): {"system"},
    ("NEGOTIATING", "AGREED"): {"system"},  # via propose/accept flow
    ("AGREED", "PAYMENT_PENDING"): {"buyer"},
    ("PAYMENT_PENDING", "PAID"): {"buyer"},
    ("PAID", "FULFILLMENT_PENDING"): {"seller"},
    ("FULFILLMENT_PENDING", "FULFILLED"): {"seller"},
    ("FULFILLED", "COMPLETED"): {"buyer"},
    # exceptions
    ("CONVERSATION_STARTED", "CANCELLED"): {"buyer", "seller"},
    ("NEGOTIATING", "CANCELLED"): {"buyer", "seller"},
    ("AGREED", "CANCELLED"): {"buyer", "seller"},
    ("PAYMENT_PENDING", "CANCELLED"): {"buyer", "seller"},
    ("PAID", "CANCELLED"): {"support"},
    ("FULFILLMENT_PENDING", "CANCELLED"): {"support"},
    ("PAID", "DISPUTED"): {"system"},
    ("FULFILLMENT_PENDING", "DISPUTED"): {"system"},
    ("FULFILLED", "DISPUTED"): {"system"},
    ("COMPLETED", "DISPUTED"): {"system"},
    ("DISPUTED", "RESOLVED"): {"system"},
}

LABELS = {
    "PAYMENT_PENDING": "Proceed to payment",
    "PAID": "Pay into Accord escrow",
    "FULFILLMENT_PENDING": "Accept order & prepare",
    "FULFILLED": "Mark shipped / handed over",
    "COMPLETED": "Confirm received as described",
    "CANCELLED": "Cancel deal",
}

ACTIVE_LEDGER_STATES = {"AGREED", "PAYMENT_PENDING", "PAID", "FULFILLMENT_PENDING", "FULFILLED"}
DISPUTABLE = {"PAID", "FULFILLMENT_PENDING", "FULFILLED", "COMPLETED"}


def can_transition(current: str, target: str, role: str) -> bool:
    return role in TRANSITIONS.get((current, target), set())


def assert_transition(current: str, target: str, role: str) -> None:
    if target not in STATES:
        raise HTTPException(422, "Unknown state")
    if (current, target) not in TRANSITIONS:
        raise HTTPException(409, f"Invalid transition {current} → {target}")
    if not can_transition(current, target, role):
        raise HTTPException(403, f"Your role cannot move this deal to {target}")


def available_actions(current: str, role: str) -> list[dict]:
    return [
        {"to": to, "label": LABELS.get(to, to.title())}
        for (frm, to), roles in TRANSITIONS.items()
        if frm == current and role in roles
    ]
