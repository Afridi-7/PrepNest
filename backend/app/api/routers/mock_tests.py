"""Mock test endpoints: generate, submit, get results."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_verified_user, get_current_pro_user, rate_limit
from app.db.models import MockTest, User
from app.db.session import get_db_session
from app.schemas.content import MockTestGenerated, MockTestSubmit, MockTestResult
from app.services.mock_test_service import (
    evaluate_mock_test,
    format_sections_for_response,
    generate_mock_test,
    SCIENCE_SUBJECTS,
)

router = APIRouter(prefix="/mock-tests", tags=["mock-tests"])

_VALID_CATEGORIES = frozenset(SCIENCE_SUBJECTS.keys())


def _validate_category(category: str) -> str:
    upper = category.upper()
    if upper not in _VALID_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category: {category}. Must be one of {sorted(_VALID_CATEGORIES)}",
        )
    return upper


# ── Generate ─────────────────────────────────────────────────────────────────

@router.post(
    "/generate",
    response_model=MockTestGenerated,
    dependencies=[Depends(rate_limit(10, "mock_gen"))],
)
async def generate(
    payload: dict,
    user: User = Depends(get_current_pro_user),
    db: AsyncSession = Depends(get_db_session),
):
    category_code = payload.get("category_code", "")
    category = _validate_category(category_code)

    mock_test = await generate_mock_test(db, user.id, category)
    clean_sections = format_sections_for_response(mock_test)

    total_mcqs = sum(
        len(s["questions"]) for s in clean_sections if s["type"] == "mcq"
    )
    total_essays = sum(
        len(s["questions"]) for s in clean_sections if s["type"] == "essay"
    )

    return MockTestGenerated(
        mock_test_id=mock_test.id,
        category=mock_test.category,
        sections=clean_sections,
        total_mcqs=total_mcqs,
        total_essays=total_essays,
    )


# ── Submit ───────────────────────────────────────────────────────────────────

@router.post(
    "/{mock_test_id}/submit",
    response_model=MockTestResult,
    dependencies=[Depends(rate_limit(10, "mock_sub"))],
)
async def submit(
    mock_test_id: str,
    payload: MockTestSubmit,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(
        select(MockTest).where(MockTest.id == mock_test_id)
    )
    mock_test = result.scalars().first()
    if not mock_test:
        raise HTTPException(status_code=404, detail="Mock test not found")
    if mock_test.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your mock test")
    if mock_test.status == "evaluated":
        raise HTTPException(status_code=400, detail="Already submitted and evaluated")

    evaluation = await evaluate_mock_test(
        db, mock_test, payload.mcq_answers, payload.essay_answers
    )
    return MockTestResult(**evaluation)


# ── Get result ───────────────────────────────────────────────────────────────

@router.get("/{mock_test_id}/result", response_model=MockTestResult)
async def get_result(
    mock_test_id: str,
    user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(
        select(MockTest).where(MockTest.id == mock_test_id)
    )
    mock_test = result.scalars().first()
    if not mock_test:
        raise HTTPException(status_code=404, detail="Mock test not found")
    if mock_test.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your mock test")
    if not mock_test.result_json:
        raise HTTPException(status_code=400, detail="Not yet submitted")

    return MockTestResult(**mock_test.result_json)
