from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import PASSWORD_POLICY_MESSAGE, validate_password_strength


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str  # Google ID token from frontend


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordValidateRequest(BaseModel):
    token: str = Field(min_length=20, max_length=512)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    new_password: str = Field(min_length=10, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        issues = validate_password_strength(value)
        if issues:
            raise ValueError(PASSWORD_POLICY_MESSAGE)
        return value


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SignupResponse(BaseModel):
    message: str


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str | None
    is_admin: bool = False
    is_verified: bool = False
    preferences: dict
    created_at: datetime
