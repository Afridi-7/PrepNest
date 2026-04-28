"""Query Room — student Q&A board.

Endpoints (all under /api/v1/query-room):
    GET    /questions               list (?tag, ?limit, ?offset, ?include_replies)
    GET    /questions/mine          questions authored by the current user
    POST   /questions               create question (auth)
    GET    /questions/{qid}         single question with replies
    DELETE /questions/{qid}         delete (author or admin)
    POST   /questions/{qid}/vote    toggle upvote (auth)
    POST   /questions/{qid}/replies post reply (auth)
    POST   /replies/{rid}/vote      toggle reply upvote (auth)
    DELETE /replies/{rid}           delete reply (author or admin)
    GET    /tags                    popular tags with counts
    GET    /leaderboard             top contributors by engagement points (monthly)

The leaderboard scoring is:
    posts*10 + replies*5 + question_upvotes_received*5 + reply_upvotes_received*3
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_pro_user, get_current_user, rate_limit
from app.db.models import (
    QueryQuestion,
    QueryQuestionVote,
    QueryReply,
    QueryReplyVote,
    User,
)
from app.db.session import get_db_session
from app.schemas.query_room import (
    AuthorMini,
    QueryLeaderboard,
    QueryLeaderEntry,
    QueryOption,
    QuestionCreate,
    QuestionListResponse,
    QuestionRead,
    ReplyCreate,
    ReplyRead,
    TagCount,
    VoteResponse,
)

router = APIRouter(prefix="/query-room", tags=["query-room"])


# ── Helpers ──────────────────────────────────────────────────────────────────


def _author_mini(u: User | None) -> AuthorMini:
    if u is None:
        return AuthorMini(id="deleted", name="[deleted user]")
    return AuthorMini(
        id=u.id,
        name=(u.full_name or u.email.split("@")[0] or "Student").strip(),
    )


async def _author_map(db: AsyncSession, user_ids: set[str]) -> dict[str, User]:
    if not user_ids:
        return {}
    rows = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
    return {u.id: u for u in rows}


async def _question_upvote_counts(
    db: AsyncSession, qids: list[str]
) -> dict[str, int]:
    if not qids:
        return {}
    rows = (
        await db.execute(
            select(
                QueryQuestionVote.question_id,
                func.count(QueryQuestionVote.user_id).label("c"),
            )
            .where(QueryQuestionVote.question_id.in_(qids))
            .group_by(QueryQuestionVote.question_id)
        )
    ).all()
    return {r.question_id: int(r.c) for r in rows}


async def _user_question_votes(
    db: AsyncSession, user_id: str, qids: list[str]
) -> set[str]:
    if not qids:
        return set()
    rows = (
        await db.execute(
            select(QueryQuestionVote.question_id).where(
                QueryQuestionVote.user_id == user_id,
                QueryQuestionVote.question_id.in_(qids),
            )
        )
    ).scalars().all()
    return set(rows)


async def _reply_upvote_counts(
    db: AsyncSession, rids: list[str]
) -> dict[str, int]:
    if not rids:
        return {}
    rows = (
        await db.execute(
            select(
                QueryReplyVote.reply_id,
                func.count(QueryReplyVote.user_id).label("c"),
            )
            .where(QueryReplyVote.reply_id.in_(rids))
            .group_by(QueryReplyVote.reply_id)
        )
    ).all()
    return {r.reply_id: int(r.c) for r in rows}


async def _user_reply_votes(
    db: AsyncSession, user_id: str, rids: list[str]
) -> set[str]:
    if not rids:
        return set()
    rows = (
        await db.execute(
            select(QueryReplyVote.reply_id).where(
                QueryReplyVote.user_id == user_id,
                QueryReplyVote.reply_id.in_(rids),
            )
        )
    ).scalars().all()
    return set(rows)


async def _reply_counts(db: AsyncSession, qids: list[str]) -> dict[str, int]:
    if not qids:
        return {}
    rows = (
        await db.execute(
            select(QueryReply.question_id, func.count(QueryReply.id).label("c"))
            .where(QueryReply.question_id.in_(qids))
            .group_by(QueryReply.question_id)
        )
    ).all()
    return {r.question_id: int(r.c) for r in rows}


def _serialize_options(raw) -> list[QueryOption] | None:
    if not raw:
        return None
    out: list[QueryOption] = []
    for opt in raw:
        if isinstance(opt, dict) and "label" in opt and "text" in opt:
            try:
                out.append(QueryOption(label=opt["label"], text=opt["text"]))
            except Exception:
                continue
    return out or None


# ── Routes ───────────────────────────────────────────────────────────────────


@router.get("/questions", response_model=QuestionListResponse)
async def list_questions(
    tag: str | None = Query(default=None, max_length=30),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    include_replies: bool = Query(default=False),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(120, "qr_list")),
):
    stmt = select(QueryQuestion).order_by(QueryQuestion.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    if tag:
        t = tag.strip().lower().lstrip("#")
        rows = [q for q in rows if t in (q.tags_json or [])]
    total = len(rows)
    rows = rows[offset : offset + limit]

    qids = [q.id for q in rows]
    user_ids = {q.user_id for q in rows}
    upvote_map = await _question_upvote_counts(db, qids)
    reply_map = await _reply_counts(db, qids)
    voted: set[str] = set()
    # Voting state requires an authenticated user; this endpoint is public so
    # we leave has_upvoted = False for anonymous callers. The client can call
    # GET /questions/{id} to fetch its own vote state.

    replies_by_q: dict[str, list[ReplyRead]] = {}
    if include_replies and qids:
        all_replies = (
            await db.execute(
                select(QueryReply)
                .where(QueryReply.question_id.in_(qids))
                .order_by(QueryReply.created_at.asc())
            )
        ).scalars().all()
        rids = [r.id for r in all_replies]
        r_upvotes = await _reply_upvote_counts(db, rids)
        user_ids.update(r.user_id for r in all_replies)
        author_lookup = await _author_map(db, user_ids)
        for r in all_replies:
            replies_by_q.setdefault(r.question_id, []).append(
                ReplyRead(
                    id=r.id,
                    body=r.body,
                    is_accepted=bool(r.is_accepted),
                    upvotes=r_upvotes.get(r.id, 0),
                    has_upvoted=False,
                    author=_author_mini(author_lookup.get(r.user_id)),
                    created_at=r.created_at,
                )
            )
    else:
        author_lookup = await _author_map(db, user_ids)

    items = [
        QuestionRead(
            id=q.id,
            title=q.title,
            body=q.body,
            q_type=q.q_type,
            options=_serialize_options(q.options_json),
            correct_label=q.correct_label,
            tags=list(q.tags_json or []),
            solved=bool(q.solved),
            accepted_reply_id=q.accepted_reply_id,
            upvotes=upvote_map.get(q.id, 0),
            has_upvoted=q.id in voted,
            reply_count=reply_map.get(q.id, 0),
            author=_author_mini(author_lookup.get(q.user_id)),
            created_at=q.created_at,
            replies=replies_by_q.get(q.id) if include_replies else None,
        )
        for q in rows
    ]
    return QuestionListResponse(items=items, total=total)


@router.get("/questions/mine", response_model=QuestionListResponse)
async def list_my_questions(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "qr_mine")),
):
    """Questions authored by the current user, newest first."""
    stmt = (
        select(QueryQuestion)
        .where(QueryQuestion.user_id == user.id)
        .order_by(QueryQuestion.created_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    total = len(rows)
    rows = rows[offset : offset + limit]

    qids = [q.id for q in rows]
    upvote_map = await _question_upvote_counts(db, qids)
    reply_map = await _reply_counts(db, qids)
    voted = await _user_question_votes(db, qids, user.id)
    author_lookup = await _author_map(db, {q.user_id for q in rows})

    items = [
        QuestionRead(
            id=q.id,
            title=q.title,
            body=q.body,
            q_type=q.q_type,
            options=_serialize_options(q.options_json),
            correct_label=q.correct_label,
            tags=list(q.tags_json or []),
            solved=bool(q.solved),
            accepted_reply_id=q.accepted_reply_id,
            upvotes=upvote_map.get(q.id, 0),
            has_upvoted=q.id in voted,
            reply_count=reply_map.get(q.id, 0),
            author=_author_mini(author_lookup.get(q.user_id)),
            created_at=q.created_at,
            replies=None,
        )
        for q in rows
    ]
    return QuestionListResponse(items=items, total=total)


@router.post(
    "/questions",
    response_model=QuestionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_question(
    payload: QuestionCreate,
    user: User = Depends(get_current_pro_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(10, "qr_post")),
):
    q = QueryQuestion(
        user_id=user.id,
        title=payload.title.strip(),
        body=payload.body.strip(),
        q_type=payload.q_type,
        options_json=(
            [o.model_dump() for o in payload.options] if payload.options else None
        ),
        correct_label=payload.correct_label,
        tags_json=payload.tags,
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return QuestionRead(
        id=q.id,
        title=q.title,
        body=q.body,
        q_type=q.q_type,
        options=_serialize_options(q.options_json),
        correct_label=q.correct_label,
        tags=list(q.tags_json or []),
        solved=False,
        accepted_reply_id=None,
        upvotes=0,
        has_upvoted=False,
        reply_count=0,
        author=_author_mini(user),
        created_at=q.created_at,
        replies=[],
    )


async def _get_question_or_404(db: AsyncSession, qid: str) -> QueryQuestion:
    q = (
        await db.execute(select(QueryQuestion).where(QueryQuestion.id == qid))
    ).scalar_one_or_none()
    if q is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return q


async def _get_reply_or_404(db: AsyncSession, rid: str) -> QueryReply:
    r = (
        await db.execute(select(QueryReply).where(QueryReply.id == rid))
    ).scalar_one_or_none()
    if r is None:
        raise HTTPException(status_code=404, detail="Reply not found")
    return r


@router.get("/questions/{qid}", response_model=QuestionRead)
async def get_question(
    qid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(120, "qr_one")),
):
    return await _build_question_read(db, qid, user)


async def _build_question_read(
    db: AsyncSession, qid: str, user: User
) -> QuestionRead:
    q = await _get_question_or_404(db, qid)
    replies = (
        await db.execute(
            select(QueryReply)
            .where(QueryReply.question_id == qid)
            .order_by(QueryReply.is_accepted.desc(), QueryReply.created_at.asc())
        )
    ).scalars().all()
    rids = [r.id for r in replies]
    r_upvote_map = await _reply_upvote_counts(db, rids)
    r_voted = await _user_reply_votes(db, user.id, rids)
    q_upvotes = (await _question_upvote_counts(db, [qid])).get(qid, 0)
    q_voted = await _user_question_votes(db, user.id, [qid])

    user_ids = {q.user_id} | {r.user_id for r in replies}
    authors = await _author_map(db, user_ids)

    return QuestionRead(
        id=q.id,
        title=q.title,
        body=q.body,
        q_type=q.q_type,
        options=_serialize_options(q.options_json),
        correct_label=q.correct_label,
        tags=list(q.tags_json or []),
        solved=bool(q.solved),
        accepted_reply_id=q.accepted_reply_id,
        upvotes=q_upvotes,
        has_upvoted=qid in q_voted,
        reply_count=len(replies),
        author=_author_mini(authors.get(q.user_id)),
        created_at=q.created_at,
        replies=[
            ReplyRead(
                id=r.id,
                body=r.body,
                is_accepted=bool(r.is_accepted),
                upvotes=r_upvote_map.get(r.id, 0),
                has_upvoted=r.id in r_voted,
                author=_author_mini(authors.get(r.user_id)),
                created_at=r.created_at,
            )
            for r in replies
        ],
    )


@router.delete("/questions/{qid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    qid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(30, "qr_del")),
):
    q = await _get_question_or_404(db, qid)
    if q.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed")
    await db.delete(q)
    await db.commit()
    return None


@router.post("/questions/{qid}/vote", response_model=VoteResponse)
async def vote_question(
    qid: str,
    user: User = Depends(get_current_pro_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "qr_vote_q")),
):
    q = await _get_question_or_404(db, qid)
    if q.user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot upvote your own question.")
    existing = (
        await db.execute(
            select(QueryQuestionVote).where(
                QueryQuestionVote.question_id == qid,
                QueryQuestionVote.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(QueryQuestionVote(question_id=qid, user_id=user.id))
        has = True
    else:
        await db.delete(existing)
        has = False
    await db.commit()
    upvotes = (await _question_upvote_counts(db, [qid])).get(qid, 0)
    return VoteResponse(upvotes=upvotes, has_upvoted=has)


@router.post(
    "/questions/{qid}/replies",
    response_model=ReplyRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_reply(
    qid: str,
    payload: ReplyCreate,
    user: User = Depends(get_current_pro_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(30, "qr_reply")),
):
    await _get_question_or_404(db, qid)
    r = QueryReply(question_id=qid, user_id=user.id, body=payload.body.strip())
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return ReplyRead(
        id=r.id,
        body=r.body,
        is_accepted=False,
        upvotes=0,
        has_upvoted=False,
        author=_author_mini(user),
        created_at=r.created_at,
    )


@router.post("/replies/{rid}/vote", response_model=VoteResponse)
async def vote_reply(
    rid: str,
    user: User = Depends(get_current_pro_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "qr_vote_r")),
):
    r = await _get_reply_or_404(db, rid)
    if r.user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot upvote your own reply.")
    existing = (
        await db.execute(
            select(QueryReplyVote).where(
                QueryReplyVote.reply_id == rid,
                QueryReplyVote.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(QueryReplyVote(reply_id=rid, user_id=user.id))
        has = True
    else:
        await db.delete(existing)
        has = False
    await db.commit()
    upvotes = (await _reply_upvote_counts(db, [rid])).get(rid, 0)
    return VoteResponse(upvotes=upvotes, has_upvoted=has)


@router.delete("/replies/{rid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reply(
    rid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(30, "qr_rdel")),
):
    r = await _get_reply_or_404(db, rid)
    if r.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed")
    # If this reply was the accepted one, unmark the question.
    q = await _get_question_or_404(db, r.question_id)
    if q.accepted_reply_id == r.id:
        q.accepted_reply_id = None
        q.solved = False
    await db.delete(r)
    await db.commit()
    return None


@router.get("/tags", response_model=list[TagCount])
async def list_tags(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "qr_tags")),
):
    rows = (await db.execute(select(QueryQuestion.tags_json))).scalars().all()
    counts: dict[str, int] = {}
    for tags in rows:
        if not tags:
            continue
        for t in tags:
            if isinstance(t, str):
                counts[t] = counts.get(t, 0) + 1
    sorted_tags = sorted(counts.items(), key=lambda x: (-x[1], x[0]))[:limit]
    return [TagCount(tag=t, count=c) for t, c in sorted_tags]


@router.get("/leaderboard", response_model=QueryLeaderboard)
async def query_leaderboard(
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db_session),
    _rl=Depends(rate_limit(60, "qr_leader")),
):
    # Monthly reset — only count engagement from the start of the current
    # UTC month onward. Fixed top-of-the-month rollover, no cron needed.
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    posts_sq = (
        select(
            QueryQuestion.user_id.label("uid"),
            func.count(QueryQuestion.id).label("c"),
        )
        .where(QueryQuestion.created_at >= month_start)
        .group_by(QueryQuestion.user_id)
        .subquery()
    )
    replies_sq = (
        select(
            QueryReply.user_id.label("uid"),
            func.count(QueryReply.id).label("c"),
        )
        .where(QueryReply.created_at >= month_start)
        .group_by(QueryReply.user_id)
        .subquery()
    )
    qvotes_sq = (
        select(
            QueryQuestion.user_id.label("uid"),
            func.count(QueryQuestionVote.user_id).label("c"),
        )
        .join(QueryQuestionVote, QueryQuestionVote.question_id == QueryQuestion.id)
        .where(QueryQuestionVote.created_at >= month_start)
        .group_by(QueryQuestion.user_id)
        .subquery()
    )
    rvotes_sq = (
        select(
            QueryReply.user_id.label("uid"),
            func.count(QueryReplyVote.user_id).label("c"),
        )
        .join(QueryReplyVote, QueryReplyVote.reply_id == QueryReply.id)
        .where(QueryReplyVote.created_at >= month_start)
        .group_by(QueryReply.user_id)
        .subquery()
    )

    posts_c = func.coalesce(posts_sq.c.c, 0)
    replies_c = func.coalesce(replies_sq.c.c, 0)
    qvotes_c = func.coalesce(qvotes_sq.c.c, 0)
    rvotes_c = func.coalesce(rvotes_sq.c.c, 0)

    points_expr = (
        posts_c * 10
        + replies_c * 5
        + qvotes_c * 5
        + rvotes_c * 3
    )

    stmt = (
        select(
            User.id,
            User.full_name,
            User.email,
            posts_c.label("posts"),
            replies_c.label("replies"),
            (qvotes_c + rvotes_c).label("upvotes_received"),
            points_expr.label("points"),
        )
        .outerjoin(posts_sq, posts_sq.c.uid == User.id)
        .outerjoin(replies_sq, replies_sq.c.uid == User.id)
        .outerjoin(qvotes_sq, qvotes_sq.c.uid == User.id)
        .outerjoin(rvotes_sq, rvotes_sq.c.uid == User.id)
        .where(points_expr > 0)
        .order_by(points_expr.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    entries = [
        QueryLeaderEntry(
            user_id=str(r.id),
            user_name=(r.full_name or (r.email or "Student").split("@")[0]).strip(),
            points=int(r.points or 0),
            posts=int(r.posts or 0),
            replies=int(r.replies or 0),
            accepted=0,
            upvotes_received=int(r.upvotes_received or 0),
        )
        for r in rows
    ]
    return QueryLeaderboard(
        entries=entries,
        period_label=month_start.strftime("%B %Y"),
        period_start=month_start.isoformat(),
    )
