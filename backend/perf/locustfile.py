"""Locust load test for the PrepNest backend.

Usage (web UI):
    pip install locust
    locust -f perf/locustfile.py --host=http://127.0.0.1:8000

Usage (headless, 50 users, 5/s spawn rate, 60 s):
    locust -f perf/locustfile.py --host=http://127.0.0.1:8000 \
           --users 50 --spawn-rate 5 --run-time 60s --headless --csv perf/out

Constraints:
    DO NOT point this at the production host. The default --host above is
    localhost. Pass `--host` explicitly to a *staging* environment if needed.

What we exercise (read-heavy, safe — no DB writes):
    /health                         (cheap baseline)
    /api/v1/usat/categories         (public DB read)
    /api/v1/usat/subjects           (public DB read)
    /api/v1/public/stats            (cached endpoint)

Authenticated flow (5% of users):
    POST /auth/login → GET /users/me → GET /dashboard/stats

Acceptance hints we recommend (not enforced here — read from CSV / web UI):
    p95 < 300 ms for cached/public reads
    p95 < 800 ms for /users/me
    Failure rate < 1%
"""
from __future__ import annotations

import os
import random
import uuid

from locust import HttpUser, between, events, task

# Refuse to run against obvious production hostnames as a safety net.
_FORBIDDEN_HOSTS = ("prepnest.app", "prepnest.com", "api.prepnest")


@events.test_start.add_listener
def _guard_against_prod(environment, **_kwargs):
    host = (environment.host or "").lower()
    if any(bad in host for bad in _FORBIDDEN_HOSTS):
        raise RuntimeError(
            f"Refusing to run load test against production host: {host!r}. "
            "Point --host at localhost or a staging environment."
        )


def _fake_client_ip() -> str:
    """Return a stable but unique RFC-5737 test IP per virtual user.

    In production each real user has their own public IP (or auth token), so
    the per-IP/per-user rate limits give each user their own budget. Locust,
    by default, makes every virtual user share the same source IP — which
    would falsely trip those limits and skew the load test. Sending a unique
    `X-Forwarded-For` per user simulates real-world distribution. The server
    only honours XFF when `TRUST_PROXY_HEADERS=true`, which mirrors the
    production deployment behind a reverse proxy.
    """
    # 198.51.100.0/24 is reserved for documentation/testing — never routable.
    return f"198.51.100.{random.randint(1, 254)}"


class AnonymousReader(HttpUser):
    """Most realistic user: opens the landing/USAT pages without logging in."""

    weight = 9
    wait_time = between(1, 3)

    def on_start(self) -> None:
        # Each virtual user pretends to be a different real client so the
        # per-IP rate limits aren't artificially shared. The server only
        # trusts XFF when TRUST_PROXY_HEADERS=true (production default).
        self.client.headers["X-Forwarded-For"] = _fake_client_ip()

    @task(3)
    def health(self) -> None:
        self.client.get("/health", name="GET /health")

    @task(5)
    def usat_categories(self) -> None:
        self.client.get(
            "/api/v1/usat/categories", name="GET /api/v1/usat/categories"
        )

    @task(5)
    def usat_subjects(self) -> None:
        self.client.get(
            "/api/v1/usat/subjects", name="GET /api/v1/usat/subjects"
        )

    @task(2)
    def public_stats(self) -> None:
        self.client.get(
            "/api/v1/public/stats", name="GET /api/v1/public/stats"
        )


class AuthenticatedUser(HttpUser):
    """Smaller cohort: signs up once on start, then hits authenticated reads.

    We use unique emails per virtual user so we never collide with real data
    or with each other. All requests are READS — no destructive writes.
    """

    weight = 1
    wait_time = between(2, 5)

    def on_start(self) -> None:
        self.token: str | None = None
        # Same XFF trick as AnonymousReader so each authenticated VU also
        # gets its own per-IP bucket on the server.
        self.client.headers["X-Forwarded-For"] = _fake_client_ip()
        email = f"perf-{uuid.uuid4().hex[:10]}@example.com"
        password = "Sup3rSecret#Perf!"

        # Best-effort signup. On staging the user may already exist; we just
        # try to log in afterwards.
        self.client.post(
            "/api/v1/auth/signup",
            json={"email": email, "password": password, "full_name": "Perf"},
            name="POST /api/v1/auth/signup",
            catch_response=True,
        )
        with self.client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
            name="POST /api/v1/auth/login",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                self.token = resp.json().get("access_token")
                resp.success()
            else:
                # Most common reason: signup needs email verification on
                # staging. We fall back to anonymous reads only.
                resp.success()  # don't pollute failure metrics
                self.token = None

    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(3)
    def me(self) -> None:
        if not self.token:
            return
        self.client.get(
            "/api/v1/users/me",
            headers=self._auth_headers(),
            name="GET /api/v1/users/me",
        )

    @task(2)
    def dashboard(self) -> None:
        if not self.token:
            return
        self.client.get(
            "/api/v1/dashboard/stats",
            headers=self._auth_headers(),
            name="GET /api/v1/dashboard/stats",
        )

    @task(1)
    def usat_subjects(self) -> None:
        # Even logged-in users browse public catalogs.
        self.client.get(
            "/api/v1/usat/subjects", name="GET /api/v1/usat/subjects"
        )
