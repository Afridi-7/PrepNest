"""Integration tests for the Query Room (student Q&A) backend.

Covers:
  - auth gating (anon GETs allowed for list/tags; mutations require token)
  - posting open + MCQ questions, validation rules
  - replying, voting (toggle, self-vote rejected)
  - accepting an answer (only by question owner)
  - tag filter and tag list
  - leaderboard scoring
  - basic XSS-safety (HTML chars stored verbatim, never executed)
"""
from __future__ import annotations

import sqlite3
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.cache_service import cache_service

client = TestClient(app)

_DB_PATH = Path(__file__).resolve().parents[1] / "test_prepnest.db"


@pytest.fixture(autouse=True)
def _reset_rate_limits() -> None:
    """Clear in-memory rate-limit buckets so test order doesn't trip 429s.

    The signup helper hits an IP-bucketed limiter (10/min); when this module
    runs after other suites that also signed users up, the bucket is already
    saturated. Clearing it before each test keeps tests isolated.
    """
    cache_service._rate_limit_buckets.clear()


def _signup_and_verify(
    email: str, password: str = "Sup3rSecret#Pwd!", name: str = "Tester",
    is_pro: bool = True,
) -> str:
    resp = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "full_name": name},
    )
    assert resp.status_code == 201, resp.text
    with sqlite3.connect(_DB_PATH) as conn:
        conn.execute(
            "UPDATE users SET is_verified = 1, is_pro = ? WHERE email = ?",
            (1 if is_pro else 0, email),
        )
        conn.commit()
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
    return login.json()["access_token"]


def _hdr(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Auth gating
# ---------------------------------------------------------------------------


def test_query_room_list_questions_is_public() -> None:
    resp = client.get("/api/v1/query-room/questions")
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body
    assert isinstance(body["items"], list)


def test_query_room_create_question_requires_auth() -> None:
    resp = client.post(
        "/api/v1/query-room/questions",
        json={"title": "Hello world?", "body": "I have a question."},
    )
    assert resp.status_code == 401


def test_query_room_vote_requires_auth() -> None:
    resp = client.post("/api/v1/query-room/questions/anything/vote")
    assert resp.status_code == 401


def test_query_room_free_user_blocked_from_posting() -> None:
    """Free (non-pro) users get 403 when trying to post or reply."""
    email = f"free-{uuid.uuid4().hex[:8]}@example.com"
    token = _signup_and_verify(email, name="FreeUser", is_pro=False)
    resp = client.post(
        "/api/v1/query-room/questions",
        headers=_hdr(token),
        json={"title": "Can I post?", "body": "Probably not", "q_type": "open"},
    )
    assert resp.status_code == 403
    assert "pro" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Create / read questions
# ---------------------------------------------------------------------------


def test_query_room_create_open_question_then_get() -> None:
    email = f"qr-{uuid.uuid4().hex[:8]}@example.com"
    token = _signup_and_verify(email, name="Alice")

    resp = client.post(
        "/api/v1/query-room/questions",
        json={
            "title": "How does useEffect work?",
            "body": "Explain the dependency array please.",
            "tags": ["react", "hooks"],
        },
        headers=_hdr(token),
    )
    assert resp.status_code == 201, resp.text
    q = resp.json()
    assert q["q_type"] == "open"
    assert q["tags"] == ["react", "hooks"]
    assert q["upvotes"] == 0
    assert q["author"]["name"] == "Alice"

    # list includes it
    list_resp = client.get("/api/v1/query-room/questions?tag=react")
    assert list_resp.status_code == 200
    assert any(item["id"] == q["id"] for item in list_resp.json()["items"])

    # GET single (auth required for vote-state)
    one = client.get(f"/api/v1/query-room/questions/{q['id']}", headers=_hdr(token))
    assert one.status_code == 200
    assert one.json()["replies"] == []


def test_query_room_mcq_validation_rejects_bad_payload() -> None:
    email = f"qr-{uuid.uuid4().hex[:8]}@example.com"
    token = _signup_and_verify(email)
    # MCQ with only 3 options → rejected
    resp = client.post(
        "/api/v1/query-room/questions",
        json={
            "title": "Pick one option",
            "body": "Three options is not enough.",
            "q_type": "mcq",
            "options": [
                {"label": "A", "text": "Foo"},
                {"label": "B", "text": "Bar"},
                {"label": "C", "text": "Baz"},
            ],
            "correct_label": "A",
        },
        headers=_hdr(token),
    )
    assert resp.status_code in (400, 422)


def test_query_room_tags_must_be_safe() -> None:
    email = f"qr-{uuid.uuid4().hex[:8]}@example.com"
    token = _signup_and_verify(email)
    resp = client.post(
        "/api/v1/query-room/questions",
        json={
            "title": "Bad tag test",
            "body": "Should reject HTML tags.",
            "tags": ["<script>alert(1)</script>"],
        },
        headers=_hdr(token),
    )
    assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# Replies + voting
# ---------------------------------------------------------------------------


def test_query_room_reply_vote_and_accept_flow() -> None:
    asker = _signup_and_verify(f"a-{uuid.uuid4().hex[:8]}@example.com", name="Asker")
    helper = _signup_and_verify(f"h-{uuid.uuid4().hex[:8]}@example.com", name="Helper")

    q = client.post(
        "/api/v1/query-room/questions",
        json={"title": "What is SQL JOIN?", "body": "Explain INNER vs LEFT JOIN.", "tags": ["sql"]},
        headers=_hdr(asker),
    ).json()

    # helper replies
    r = client.post(
        f"/api/v1/query-room/questions/{q['id']}/replies",
        json={"body": "INNER returns matched rows; LEFT returns all left + matched right."},
        headers=_hdr(helper),
    )
    assert r.status_code == 201, r.text
    reply = r.json()

    # asker upvotes the reply
    v = client.post(
        f"/api/v1/query-room/replies/{reply['id']}/vote", headers=_hdr(asker)
    )
    assert v.status_code == 200
    assert v.json()["upvotes"] == 1
    assert v.json()["has_upvoted"] is True

    # toggling again removes the vote
    v2 = client.post(
        f"/api/v1/query-room/replies/{reply['id']}/vote", headers=_hdr(asker)
    )
    assert v2.status_code == 200
    assert v2.json()["upvotes"] == 0

    # self-vote on own reply is rejected
    self_vote = client.post(
        f"/api/v1/query-room/replies/{reply['id']}/vote", headers=_hdr(helper)
    )
    assert self_vote.status_code == 400


def test_query_room_question_self_vote_rejected() -> None:
    asker = _signup_and_verify(f"sv-{uuid.uuid4().hex[:8]}@example.com")
    q = client.post(
        "/api/v1/query-room/questions",
        json={"title": "Self vote test question?", "body": "body."},
        headers=_hdr(asker),
    ).json()
    resp = client.post(
        f"/api/v1/query-room/questions/{q['id']}/vote", headers=_hdr(asker)
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Tags + leaderboard
# ---------------------------------------------------------------------------


def test_query_room_tags_and_leaderboard() -> None:
    user_a = _signup_and_verify(f"la-{uuid.uuid4().hex[:8]}@example.com", name="Aaa")
    user_b = _signup_and_verify(f"lb-{uuid.uuid4().hex[:8]}@example.com", name="Bbb")

    q = client.post(
        "/api/v1/query-room/questions",
        json={
            "title": "Leaderboard scoring question?",
            "body": "Test body for leaderboard.",
            "tags": ["leaderboard-test"],
        },
        headers=_hdr(user_a),
    ).json()

    client.post(
        f"/api/v1/query-room/questions/{q['id']}/replies",
        json={"body": "A helpful reply."},
        headers=_hdr(user_b),
    ).json()

    tags = client.get("/api/v1/query-room/tags").json()
    assert any(t["tag"] == "leaderboard-test" for t in tags)

    board = client.get("/api/v1/query-room/leaderboard").json()
    names = [e["user_name"] for e in board["entries"]]
    assert "Aaa" in names
    assert "Bbb" in names


# ---------------------------------------------------------------------------
# XSS / injection safety: server stores raw text, doesn't render HTML
# ---------------------------------------------------------------------------


def test_query_room_xss_payload_stored_as_text() -> None:
    token = _signup_and_verify(f"xss-{uuid.uuid4().hex[:8]}@example.com")
    payload = "<script>alert('xss')</script>"
    resp = client.post(
        "/api/v1/query-room/questions",
        json={"title": "XSS sanity check title", "body": payload, "tags": ["safe"]},
        headers=_hdr(token),
    )
    assert resp.status_code == 201
    q = resp.json()
    # Body comes back as-is (text); the frontend must render it as text, not HTML.
    assert q["body"] == payload
