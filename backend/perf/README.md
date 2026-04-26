# Performance Testing

Two complementary tools live here. Both are read-heavy and **safe** — they
never run against production hosts.

## 1. In-process latency bench (no extra deps)

Measures median / p95 / max latency for hot read endpoints by calling the
FastAPI app directly through `TestClient`. Useful as a regression gate.

```powershell
cd backend
python -m perf.bench                 # 100 iterations per endpoint
python -m perf.bench --iterations 500
```

Sample output (measured locally on Windows + Python 3.11 + SQLite, n=100):

```
Endpoint                                    median       p95       max      mean   fail
--------------------------------------------------------------------------------------
GET /health                                 1.98ms    2.99ms    3.38ms    2.01ms      0
GET /api/v1/usat/categories                 2.43ms    3.97ms    5.60ms    2.65ms      0
GET /api/v1/usat/subjects                   7.22ms    9.21ms   50.42ms    7.65ms      0
GET /api/v1/public/stats                    3.16ms    4.23ms    5.21ms    3.21ms      0
```

Observations from the sample run:

- `/health` and `/api/v1/usat/categories` are pure-Python / cached and stay
  under 5 ms p95 — these are not bottlenecks.
- `/api/v1/usat/subjects` shows a `max` outlier (~50 ms) caused by the first
  uncached query after warmup. Median and p95 are still healthy.
- `/api/v1/public/stats` performs three `COUNT(*)` queries; expect this to
  scale linearly with table size on Postgres. Add a cache layer if it
  trends over 100 ms p95 in production.
- Bench uses an isolated SQLite DB (`backend/perf_bench.db`) so it never
  touches the production Supabase instance.

## 2. Locust load test (multi-user simulation)

Simulates concurrent virtual users, including a small cohort that signs up
and hits authenticated endpoints. Run against a local dev server, never
production.

```powershell
pip install locust
cd backend

# Make sure the backend is running first:
python -m uvicorn app.main:app --port 8000

# Web UI (open http://localhost:8089):
locust -f perf/locustfile.py --host=http://127.0.0.1:8000

# Headless: 50 virtual users, ramp 5/s, run 60 s, dump CSVs:
locust -f perf/locustfile.py --host=http://127.0.0.1:8000 `
       --users 50 --spawn-rate 5 --run-time 60s --headless --csv perf/out
```

The locustfile **refuses to start** if `--host` looks like production
(`prepnest.app`, `prepnest.com`, `api.prepnest…`).

### What it exercises

| Cohort               | Weight | Endpoints                                                        |
|----------------------|:------:|-------------------------------------------------------------------|
| `AnonymousReader`    |  90%   | `/health`, `/api/v1/usat/categories`, `/api/v1/usat/subjects`, `/api/v1/public/stats` |
| `AuthenticatedUser`  |  10%   | signup → login → `/users/me`, `/dashboard/stats`, `/usat/subjects` |

### Suggested acceptance thresholds (review in CSV / web UI)

- `p95 < 300 ms` for cached / public reads
- `p95 < 800 ms` for `/users/me` and `/dashboard/stats`
- failure rate `< 1 %`
- no sustained 429s below 300 req/min/IP (matches the global rate limit)

### Common bottlenecks to look for

- **DB connection pool exhaustion** at high concurrency → `/dashboard/stats`
  p95 climbs sharply. Tune `pool_size` / `max_overflow` in `db/session.py`.
- **N+1 queries** on USAT catalog endpoints if subject/topic eager-loading
  regresses. Compare bench numbers vs. last known good.
- **Cache-miss thundering herd** on `/public/stats` if Redis is down (the
  service falls back to in-memory; latency should stay sub-10 ms).
- **Rate-limit middleware** can mask true latency: if you see 429s in load
  test output, raise `_GLOBAL_LIMIT_PER_MIN` in `app/main.py` *for staging
  only* before re-running.
