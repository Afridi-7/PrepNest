"""Subscription plan catalogue.

Single source of truth for plan codes, pricing, and durations. Prices are
stored as integer minor units (paisa for PKR) to avoid floating-point drift
when comparing webhook amounts to expected amounts. The frontend renders
human-readable labels; never trust the frontend's notion of price — the
backend resolves price from `plan_code` server-side before creating any
Safepay order.
"""

from __future__ import annotations

from typing import TypedDict


class PlanDef(TypedDict):
    code: str
    name: str
    description: str
    price_minor: int          # smallest currency unit (paisa)
    currency: str             # ISO 4217
    interval_days: int        # how long Pro is granted on successful payment
    badge: str | None
    highlight: bool


# ---------------------------------------------------------------------------
# HOW TO CHANGE THE SUBSCRIPTION PRICE
# ---------------------------------------------------------------------------
# Edit `price_minor` below. The number is in PAISA (1 PKR = 100 paisa).
#   PKR 850   ->   85000
#   PKR 999   ->   99900
#   PKR 1,500 ->  150000
# After editing, restart the backend. No DB migration is needed — the price
# is read fresh from this file on every checkout. Existing paid users keep
# the access they already paid for; only NEW orders use the new price.
# ---------------------------------------------------------------------------

SUBSCRIPTION_PLANS: dict[str, PlanDef] = {
    "pro_monthly": {
        "code": "pro_monthly",
        "name": "Pro Monthly",
        "description": "Full access, billed every month. Cancel anytime.",
        "price_minor": 85000,        # PKR 850.00  <-- change this number to set a new price
        "currency": "PKR",
        "interval_days": 30,
        "badge": None,
        "highlight": True,
    },
}


def get_plan(code: str) -> PlanDef | None:
    return SUBSCRIPTION_PLANS.get(code)


def list_plans() -> list[PlanDef]:
    return list(SUBSCRIPTION_PLANS.values())
