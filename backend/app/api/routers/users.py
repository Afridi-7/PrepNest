from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_current_user
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session
from app.models import User
from app.schemas.user_crud import DeleteUserResponse, SetProRequest, UserAdminView, UserPublic
from app.schemas.user import UserResponse
from app.services.user_crud_service import UserCrudService

router = APIRouter(prefix="/users", tags=["users"])
service = UserCrudService()

# Hard cap on user-controlled JSON blob persisted to the users table.
# 8 KB is generous for theme/locale-style preferences and prevents abuse.
_MAX_PREFERENCES_BYTES = 8 * 1024


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_admin=current_user.is_admin,
        is_pro=current_user.is_pro or current_user.is_admin,
        preferences=current_user.preferences or {},
        created_at=current_user.created_at,
    )


@router.patch("/me/preferences", response_model=UserResponse)
async def update_preferences(
    preferences: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    # Cap the payload size to prevent users storing arbitrarily large blobs in the
    # users table (DoS via row bloat). 8 KB serialized JSON is more than enough
    # for theme / locale / display preferences.
    import json as _json
    try:
        size = len(_json.dumps(preferences))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Preferences must be JSON-serialisable")
    if size > _MAX_PREFERENCES_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Preferences payload too large ({size} bytes; max {_MAX_PREFERENCES_BYTES}).",
        )

    repo = UserRepository(db)
    user = await repo.update_preferences(current_user, preferences)
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_admin=user.is_admin,
        is_pro=user.is_pro or user.is_admin,
        preferences=user.preferences or {},
        created_at=user.created_at,
    )


@router.get("", response_model=list[UserAdminView])
async def list_users(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> list[UserAdminView]:
    """Admin-only: list all users with their roles."""
    repo = UserRepository(db)
    users = await repo.list_all()
    return [UserAdminView.model_validate(u) for u in users]


@router.patch("/{user_id}/pro", response_model=UserAdminView)
async def set_user_pro_status(
    user_id: str,
    body: SetProRequest,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> UserAdminView:
    """Admin-only: grant or revoke Pro status for a user."""
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updated = await repo.set_pro_status(user, body.is_pro)
    return UserAdminView.model_validate(updated)


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
