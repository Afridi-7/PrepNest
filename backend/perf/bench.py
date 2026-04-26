"""Lightweight latency micro-benchmark for hot read endpoints.

Runs entirely in-process via FastAPI's TestClient (no real socket / DB
deployment needed) and reports median, p95, and max latency for each
endpoint over N iterations. This complements the Locust load test:
Locust simulates concurrent users; this script gives single-request
"how slow is this code path" numbers, useful for catching regressions
caused by N+1 queries or new middleware.

Usage:
    python -m perf.bench
    python -m perf.bench --iterations 200

Output: a small markdown-style table on stdout.
"""
from __future__ import annotations

import argparse
import os
import statistics
import sys
import time
from pathlib import Path

# Make `app.*` importable when run from `backend/`.
_BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND_DIR))

# IMPORTANT: bench must NEVER hit production. Force a local SQLite DB the
# same way the test suite does, before importing the app.
_BENCH_DB = _BACKEND_DIR / "perf_bench.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_BENCH_DB.as_posix()}"
os.environ.setdefault("RESEND_API_KEY", "")
os.environ.setdefault("OPENAI_API_KEY", "")
os.environ.setdefault("JWT_SECRET_KEY", "perf-bench-secret-not-for-prod")

try:
    from app.core.config import get_settings  # noqa: E402

    get_settings.cache_clear()
except Exception:
    pass

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services.cache_service import cache_service  # noqa: E402


def _reset_rate_limit() -> None:
    """The rate-limit middleware (300/min/IP) and per-route limits will trip
    on a tight benchmarking loop. Clear the in-memory bucket between
    endpoints so we measure handler latency, not 429 short-circuits."""
    if hasattr(cache_service, "_rate_limit_buckets"):
        cache_service._rate_limit_buckets.clear()


ENDPOINTS = [
    ("GET", "/health"),
    ("GET", "/api/v1/usat/categories"),
    ("GET", "/api/v1/usat/subjects"),
    ("GET", "/api/v1/public/stats"),
]


def measure(client: TestClient, method: str, path: str, n: int) -> dict[str, float]:
    timings_ms: list[float] = []
    failures = 0
    # Warmup so the first JIT/import cost doesn't pollute p95.
    for _ in range(min(5, n)):
        client.request(method, path)
    _reset_rate_limit()

    for i in range(n):
        # Reset every 50 iterations so we never trip the global 300/min cap
        # mid-measurement on slow machines.
        if i and i % 50 == 0:
            _reset_rate_limit()
        t0 = time.perf_counter()
        resp = client.request(method, path)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        timings_ms.append(elapsed_ms)
        if resp.status_code >= 400:
            failures += 1

    timings_ms.sort()
    return {
        "n": n,
        "failures": failures,
        "median": statistics.median(timings_ms),
        "p95": timings_ms[int(0.95 * (n - 1))],
        "max": max(timings_ms),
        "mean": statistics.mean(timings_ms),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="PrepNest in-process latency bench")
    parser.add_argument("--iterations", "-n", type=int, default=100)
    args = parser.parse_args()

    # Quiet down per-request access logs so the table is the only output.
    import logging
    logging.disable(logging.WARNING)
    for name in ("httpx", "uvicorn.access", "uvicorn.error", "app", "sqlalchemy.engine", "aiosqlite"):
        logging.getLogger(name).setLevel(logging.ERROR)

    # Use TestClient as a context manager so FastAPI startup events run
    # (creates SQLite tables before we measure anything).
    with TestClient(app) as client:
        print(f"\nIn-process latency bench  (n={args.iterations} per endpoint)\n")
        header = f"{'Endpoint':<40} {'median':>9} {'p95':>9} {'max':>9} {'mean':>9} {'fail':>6}"
        print(header)
        print("-" * len(header))

        any_failures = False
        for method, path in ENDPOINTS:
            _reset_rate_limit()
            m = measure(client, method, path, args.iterations)
            print(
                f"{method + ' ' + path:<40} "
                f"{m['median']:>7.2f}ms "
                f"{m['p95']:>7.2f}ms "
                f"{m['max']:>7.2f}ms "
                f"{m['mean']:>7.2f}ms "
                f"{m['failures']:>6d}"
            )
            if m["failures"] > 0:
                any_failures = True

    print()
    print(
        "Notes: numbers are in-process (no network). They isolate handler + "
        "DB cost.\nTo measure end-to-end including TCP/HTTP overhead, run the "
        "Locust suite at\nperf/locustfile.py against a running server."
    )
    return 1 if any_failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
