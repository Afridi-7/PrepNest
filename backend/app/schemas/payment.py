"""Pydantic schemas for the payments / subscriptions API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SubscriptionPlan(BaseModel):
    code: str
    name: str
    description: str
    price_minor: int = Field(description="Price in smallest currency unit (paisa)")
    price_display: str = Field(description="Pre-formatted human price, e.g. 'PKR 999'")
    currency: str
    interval_days: int
    badge: str | None = None
    highlight: bool = False


class CheckoutCreateRequest(BaseModel):
    plan_code: str = Field(min_length=1, max_length=64)


class CheckoutCreateResponse(BaseModel):
    payment_id: str
    tracker: str
    redirect_url: str
    plan_code: str
    amount_minor: int
    currency: str


class PaymentRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    plan_code: str
    amount_minor: int
    currency: str
    status: str
    created_at: datetime
    paid_at: datetime | None = None
    expires_at: datetime | None = None


class CheckoutVerifyResponse(BaseModel):
    status: str
    is_pro: bool
    subscription_expires_at: datetime | None = None
