from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta, date as _date
import math

from app.api.deps import get_current_admin, get_current_user
from app.db.models import MockTest, Payment, PracticeResult, User
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
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> UserResponse:
    # ── Self-heal pending payments ────────────────────────────────────────
    # If the user has any payment row in `pending` state with a Safepay
    # tracker, auto-activate it here. The Payment row was created by an
    # authenticated /checkout call, the user authenticated again to call
    # /me — that's strong evidence they completed payment. This makes Pro
    # activation work even if Safepay's webhook never fires AND the user
    # never lands on /billing/success (closed the tab, came back later
    # via direct URL, mobile flow, etc.). Best-effort and idempotent —
    # any failure is logged but does NOT break /me.
    if not current_user.is_pro:
        try:
            pending = (
                await db.execute(
                    select(Payment)
                    .where(
                        Payment.user_id == current_user.id,
                        Payment.status == "pending",
                        Payment.safepay_tracker.is_not(None),
                    )
                    .order_by(Payment.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if pending is not None:
                from app.api.routers.payments import _activate_payment, _raw_sql_activate

                try:
                    activated = await _activate_payment(payment=pending, db=db)
                    if activated:
                        await db.commit()
                        await db.refresh(current_user)
                        import logging as _logging
                        _logging.getLogger(__name__).info(
                            "Auto-activated pending payment %s for user %s on /me.",
                            pending.id, current_user.id,
                        )
                    else:
                        # ORM said no but row is still pending → raw SQL
                        await db.refresh(pending)
                        if pending.status == "pending":
                            ok = await _raw_sql_activate(payment=pending, db=db)
                            if ok:
                                await db.refresh(current_user)
                except Exception:
                    import logging as _logging
                    _logging.getLogger(__name__).exception(
                        "Auto-activation on /me failed for user %s", current_user.id,
                    )
                    try:
                        await db.rollback()
                    except Exception:
                        pass
        except Exception:
            # Most likely: payments table doesn't exist (migration didn't run).
            # Don't break /me for that — just log it once.
            import logging as _logging
            _logging.getLogger(__name__).exception(
                "Self-heal pending-payment lookup failed for user %s", current_user.id,
            )
            try:
                await db.rollback()
            except Exception:
                pass

    # "On trial" = currently Pro, not admin-granted, and no paid Payment row
    # exists. We compute this once on /me so the frontend can render the
    # trial countdown without leaking payment internals.
    is_pro_now = UserRepository.is_currently_pro(current_user)
    is_on_trial = False
    if (
        is_pro_now
        and not current_user.is_admin
        and not current_user.granted_by_admin
        and current_user.subscription_expires_at is not None
    ):
        paid_count = await db.scalar(
            select(func.count())
            .select_from(Payment)
            .where(Payment.user_id == current_user.id, Payment.status == "paid")
        )
        is_on_trial = (paid_count or 0) == 0
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_admin=current_user.is_admin,
        is_pro=is_pro_now,
        is_on_trial=is_on_trial,
        subscription_expires_at=current_user.subscription_expires_at,
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
    """Persist the client-tracked streak. Server is authoritative once
    ``streak_last_active`` is established — streak increments by 1 for each
    consecutive calendar day (UTC), resets to 1 if a day is missed."""
    repo = UserRepository(db)
    prefs = current_user.preferences or {}

    today_str = _date.today().isoformat()          # YYYY-MM-DD UTC
    yesterday_str = (_date.today() - timedelta(days=1)).isoformat()
    last_active = prefs.get("streak_last_active")
    prev_streak = int(prefs.get("streak_current") or 0)
    prev_best = int(prefs.get("streak_best") or 0)

    if last_active is None:
        # First sync ever — seed from client value (migration for existing users)
        new_streak = max(1, int(body.current))
    elif last_active == today_str:
        # Already counted today — no change
        new_streak = prev_streak
    elif last_active == yesterday_str:
        # Consecutive day: increment server value; also accept the client's
        # higher value to handle streak-saver recovery (client fills the gap
        # locally then re-syncs with the recovered count).
        new_streak = max(prev_streak + 1, int(body.current))
    else:
        # One or more days were missed — reset streak
        new_streak = 1

    new_best = max(prev_best, new_streak, int(body.best))

    user = await repo.merge_preferences(current_user, {
        "streak_current": new_streak,
        "streak_best": new_best,
        "streak_last_active": today_str,
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
    """Consume one streak-saver token. Sets streak_last_active to yesterday so
    the subsequent sync-streak call (triggered by the frontend after filling the
    gap) correctly accepts the recovered streak count via the max(prev+1, client)
    path instead of resetting."""
    prefs = current_user.preferences or {}
    remaining = int(prefs.get("streak_savers") or 0)
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="No streak savers available")

    yesterday_str = (_date.today() - timedelta(days=1)).isoformat()

    repo = UserRepository(db)
    user = await repo.merge_preferences(current_user, {
        "streak_savers": remaining - 1,
        "streak_saver_used_at": datetime.now(timezone.utc).isoformat(),
        # Roll back last_active to yesterday so the next sync-streak treats it
        # as a consecutive-day call and takes max(prev+1, client_recovered).
        "streak_last_active": yesterday_str,
    })
    xp, level = await _compute_user_xp(db, user)
    return _build_rewards_response(user, xp=xp, level=level)

