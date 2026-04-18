from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserPublic(BaseModel):
    id: int
    email: EmailStr


class UserAdminView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str | None = None
    is_admin: bool = False
    is_pro: bool = False
    is_active: bool = True
    created_at: datetime


class SetProRequest(BaseModel):
    is_pro: bool


class DeleteUserResponse(BaseModel):
    message: str
