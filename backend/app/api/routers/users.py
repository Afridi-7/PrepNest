from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.models import User
from app.schemas.user_crud import DeleteUserResponse, UserCreateRequest, UserPublic
from app.schemas.user import UserResponse
from app.services.user_crud_service import UserCrudService, is_unique_violation

router = APIRouter(prefix="/users", tags=["users"])
service = UserCrudService()


@router.post("", response_model=UserPublic, status_code=201)
async def create_user(payload: dict = Body(...)) -> UserPublic:
    try:
        user_in = UserCreateRequest.model_validate(payload)
    except ValidationError as error:
        first_error = error.errors()[0]
        message = first_error.get("msg", "Invalid request")
        raise HTTPException(status_code=400, detail=message) from error

    try:
        created = await service.create_user(email=user_in.email, password=user_in.password)
        return UserPublic.model_validate(created)
    except Exception as error:
        if is_unique_violation(error):
            raise HTTPException(status_code=409, detail="Email already in use") from error
        raise HTTPException(status_code=500, detail="Internal server error") from error


@router.get("", response_model=list[UserPublic])
async def get_users() -> list[UserPublic]:
    try:
        users = await service.list_users()
        return [UserPublic.model_validate(user) for user in users]
    except Exception as error:
        raise HTTPException(status_code=500, detail="Internal server error") from error


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_admin=current_user.is_admin,
        preferences=current_user.preferences or {},
        created_at=current_user.created_at,
    )


@router.patch("/me/preferences", response_model=UserResponse)
async def update_preferences(
    preferences: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    repo = UserRepository(db)
    user = await repo.update_preferences(current_user, preferences)
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_admin=user.is_admin,
        preferences=user.preferences or {},
        created_at=user.created_at,
    )


@router.get("/{user_id}", response_model=UserPublic)
async def get_user_by_id(user_id: int) -> UserPublic:
    try:
        user = await service.get_user_by_id(user_id=user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        return UserPublic.model_validate(user)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail="Internal server error") from error


@router.delete("/{user_id}", response_model=DeleteUserResponse)
async def delete_user(user_id: int) -> DeleteUserResponse:
    try:
        deleted = await service.delete_user(user_id=user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="User not found")
        return DeleteUserResponse(message="User deleted successfully")
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail="Internal server error") from error
