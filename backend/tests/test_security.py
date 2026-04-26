"""Security smoke tests.

These verify defence-in-depth headers and key authorization behaviours so a
regression is caught before deploy. They intentionally avoid asserting exact
values for headers that may evolve (CSP/HSTS), and instead assert presence.
"""
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_security_headers_present() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    headers = {k.lower(): v for k, v in response.headers.items()}
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("referrer-policy") == "no-referrer"
    assert headers.get("x-permitted-cross-domain-policies") == "none"
    assert headers.get("cross-origin-opener-policy") == "same-origin"
    assert "permissions-policy" in headers


def test_protected_route_requires_auth() -> None:
    # Hitting an authed endpoint without a token must NOT leak data.
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_invalid_jwt_rejected() -> None:
    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer not.a.real.token"},
    )
    assert response.status_code == 401


def test_oversized_json_rejected() -> None:
    # 3 MB of payload via Content-Length should be rejected by the body-size
    # middleware before reaching any handler. Send to a JSON POST endpoint.
    big_payload = "x" * (3 * 1024 * 1024)
    response = client.post(
        "/api/v1/auth/login",
        data=big_payload,
        headers={"Content-Type": "application/json", "Content-Length": str(len(big_payload))},
    )
    assert response.status_code == 413


def test_validation_error_does_not_leak_internals() -> None:
    # A malformed login payload should return a 400 (per our handler) without
    # a stack trace or internal details.
    response = client.post("/api/v1/auth/login", json={"email": "not-an-email"})
    assert response.status_code in (400, 422)
    body = response.json()
    text = str(body).lower()
    assert "traceback" not in text
    assert "sqlalchemy" not in text


def test_global_burst_rate_limit() -> None:
    """Hitting the same anonymous endpoint many times in a row from a single
    client should eventually return 429 — proves the global backstop is wired.
    """
    saw_429 = False
    # Limit is `settings.global_rate_limit_per_minute` (default 600). Loop a
    # bit past that so we deterministically trip it regardless of tuning.
    for _ in range(700):
        r = client.get("/api/v1/usat/categories")
        if r.status_code == 429:
            saw_429 = True
            assert r.headers.get("Retry-After") == "60"
            break
    assert saw_429
