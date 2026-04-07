from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SignupResponse(BaseModel):
    message: str
    verification_url: str | None = None


class EmailVerificationRequest(BaseModel):
    token: str = Field(min_length=16)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class VerificationResponse(BaseModel):
    message: str
    verification_url: str | None = None


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str | None
    preferences: dict
    created_at: datetime
