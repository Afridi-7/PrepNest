from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.models import User
from app.schemas.user_crud import DeleteUserResponse, UserPublic
from app.schemas.user import UserResponse
from app.services.user_crud_service import UserCrudService

router = APIRouter(prefix="/users", tags=["users"])
service = UserCrudService()


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
async def get_user_by_id(
    user_id: int,
    _admin: User = Depends(get_current_admin),
) -> UserPublic:
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
async def delete_user(
    user_id: int,
    _admin: User = Depends(get_current_admin),
) -> DeleteUserResponse:
    try:
        deleted = await service.delete_user(user_id=user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="User not found")
        return DeleteUserResponse(message="User deleted successfully")
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail="Internal server error") from error
