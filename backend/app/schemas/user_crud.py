from pydantic import BaseModel, EmailStr, Field


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserPublic(BaseModel):
    id: int
    email: EmailStr


class DeleteUserResponse(BaseModel):
    message: str
