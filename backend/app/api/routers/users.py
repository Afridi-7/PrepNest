from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
import math

from app.api.deps import get_current_admin, get_current_user
from app.db.models import MockTest, PracticeResult, User
from app.db.repositories.user_repo import UserRepository
from app.db.session import get_db_session, database_url
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
        is_pro=UserRepository.is_currently_pro(current_user),
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
        is_pro=UserRepository.is_currently_pro(user),
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


# ── Rewards / streak ─────────────────────────────────────────────────────────

VALID_REWARD_LEVELS = {3, 5, 8, 10}
STREAK_SAVER_COOLDOWN_DAYS = 30
PRO_TRIAL_DAYS = 7


class ClaimRewardRequest(BaseModel):
    level: int = Field(ge=3, le=10)


class StreakSyncRequest(BaseModel):
    current: int = Field(ge=0, le=10000)
    best: int = Field(ge=0, le=10000)


class RewardsResponse(BaseModel):
    claimed: list[int]
    streak_savers: int
    streak_current: int
    streak_best: int
    is_pro: bool
    pro_trial_expires_at: str | None = None
    is_elite: bool = False
    consistency_badge: bool = False
    user_level: int = 1
    user_xp: int = 0


async def _compute_user_xp(db: AsyncSession, user: User) -> tuple[int, int]:
    """Server-side XP recomputation from real practice + mock data.

    Mirrors the frontend formula but ignores client streak XP: the server is
    authoritative — streak XP is granted on top from preferences.streak_current.
    """
    is_sqlite = database_url.startswith("sqlite")
    if is_sqlite:
        mcq_score_expr = func.coalesce(
            cast(func.json_extract(MockTest.result_json, "$.mcq_score"), Integer), 0
        )
        mcq_total_expr = func.coalesce(
            cast(func.json_extract(MockTest.result_json, "$.mcq_total"), Integer), 0
        )
    else:
        mcq_score_expr = func.coalesce(
            cast(MockTest.result_json.op("->>")("mcq_score"), Integer), 0
        )
        mcq_total_expr = func.coalesce(
            cast(MockTest.result_json.op("->>")("mcq_total"), Integer), 0
        )

    mock_row = (await db.execute(
        select(
            func.coalesce(func.sum(mcq_score_expr), 0).label("solved"),
            func.coalesce(func.sum(mcq_total_expr), 0).label("attempted"),
            func.count(MockTest.id).label("sessions"),
        ).where(MockTest.user_id == user.id, MockTest.status == "evaluated")
    )).one()

    practice_row = (await db.execute(
        select(
            func.coalesce(func.sum(PracticeResult.correct_answers), 0).label("solved"),
            func.coalesce(func.sum(PracticeResult.total_questions), 0).label("attempted"),
            func.count(PracticeResult.id).label("sessions"),
        ).where(PracticeResult.user_id == user.id)
    )).one()

    correct = int(mock_row.solved) + int(practice_row.solved)
    attempted = int(mock_row.attempted) + int(practice_row.attempted)
    sessions = int(mock_row.sessions) + int(practice_row.sessions)

    # Streak XP — from sync-streak (server-of-record once user syncs)
    streak_current = int((user.preferences or {}).get("streak_current") or 0)

    xp = correct * 5 + attempted * 2 + sessions * 50 + streak_current * 20
    level = max(1, int((1 + math.sqrt(1 + xp / 125)) // 2))
    return xp, level


def _build_rewards_response(user: User, *, xp: int, level: int) -> RewardsResponse:
    prefs = user.preferences or {}
    claimed = [int(x) for x in (prefs.get("rewards_claimed") or []) if isinstance(x, int)]
    expires_iso = None
    if user.subscription_expires_at is not None and 5 in claimed:
        exp = user.subscription_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp > datetime.now(timezone.utc):
            expires_iso = exp.isoformat()
    return RewardsResponse(
        claimed=claimed,
        streak_savers=int(prefs.get("streak_savers") or 0),
        streak_current=int(prefs.get("streak_current") or 0),
        streak_best=int(prefs.get("streak_best") or 0),
        is_pro=UserRepository.is_currently_pro(user),
        pro_trial_expires_at=expires_iso,
        is_elite=bool(prefs.get("elite_scholar")),
        consistency_badge=3 in claimed,
        user_level=level,
        user_xp=xp,
    )


@router.get("/me/rewards", response_model=RewardsResponse)
async def get_my_rewards(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> RewardsResponse:
    xp, level = await _compute_user_xp(db, current_user)
    return _build_rewards_response(current_user, xp=xp, level=level)


@router.post("/me/sync-streak", response_model=RewardsResponse)
async def sync_streak(
    body: StreakSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> RewardsResponse:
    """Persist the client-tracked streak so it can drive server-side XP."""
    repo = UserRepository(db)
    prefs = current_user.preferences or {}
    prev_best = int(prefs.get("streak_best") or 0)
    user = await repo.merge_preferences(current_user, {
        "streak_current": int(body.current),
        "streak_best": max(prev_best, int(body.best), int(body.current)),
    })
    xp, level = await _compute_user_xp(db, user)
    return _build_rewards_response(user, xp=xp, level=level)


@router.post("/me/claim-reward", response_model=RewardsResponse)
async def claim_reward(
    body: ClaimRewardRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> RewardsResponse:
    if body.level not in VALID_REWARD_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid reward level")

    repo = UserRepository(db)
    xp, level = await _compute_user_xp(db, current_user)
    if level < body.level:
        raise HTTPException(
            status_code=403,
            detail=f"You need to reach Level {body.level} first (you're at Level {level}).",
        )

    prefs = current_user.preferences or {}
    claimed: list[int] = [int(x) for x in (prefs.get("rewards_claimed") or []) if isinstance(x, int)]
    if body.level in claimed:
        # Idempotent — return current state instead of erroring out.
        return _build_rewards_response(current_user, xp=xp, level=level)

    new_prefs: dict = {"rewards_claimed": [*claimed, body.level]}

    # Apply per-level effects
    user = current_user
    if body.level == 5:
        # 7-day Pro trial — uses real subscription_expires_at
        expires_at = datetime.now(timezone.utc) + timedelta(days=PRO_TRIAL_DAYS)
        user = await repo.grant_pro(user, expires_at=expires_at, granted_by_admin=False)
    elif body.level == 8:
        new_prefs["streak_savers"] = int(prefs.get("streak_savers") or 0) + 1
        new_prefs["streak_saver_last_grant"] = datetime.now(timezone.utc).isoformat()
    elif body.level == 10:
        new_prefs["elite_scholar"] = True

    user = await repo.merge_preferences(user, new_prefs)
    return _build_rewards_response(user, xp=xp, level=level)


@router.post("/me/use-streak-saver", response_model=RewardsResponse)
async def use_streak_saver(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> RewardsResponse:
    """Consume one streak-saver token. Frontend calls this when a missed-day
    would otherwise reset the streak. Server is the source of truth."""
    prefs = current_user.preferences or {}
    remaining = int(prefs.get("streak_savers") or 0)
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="No streak savers available")
    repo = UserRepository(db)
    user = await repo.merge_preferences(current_user, {
        "streak_savers": remaining - 1,
        "streak_saver_used_at": datetime.now(timezone.utc).isoformat(),
    })
    xp, level = await _compute_user_xp(db, user)
    return _build_rewards_response(user, xp=xp, level=level)

