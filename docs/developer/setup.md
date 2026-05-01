# Setup & Environment

This guide walks you through running PrepNest locally for development.

## Prerequisites

- **Python** 3.11+
- **Node.js** 18+ (LTS recommended) and npm
- **PostgreSQL** 15+ with the `pgvector` extension — or a **Supabase** project (pgvector enabled by default)
- **Redis** — [Upstash](https://upstash.com) free tier (TLS), local Docker, or Windows Redis
- **Git**

Optional (recommended): **Docker** + **Docker Compose** for one-command startup.

## 1. Clone the repository

```bash
git clone https://github.com/your-org/prepnest.git
cd prepnest
```

## 2. Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # macOS / Linux
pip install -r requirements.txt
```

### Environment variables

Copy `.env.example` to `backend/.env`. Do **not** wrap values in quotes.

| Key | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | asyncpg Postgres URL | `postgresql+asyncpg://user:pass@host:5432/db?sslmode=require` |
| `REDIS_URL` | Yes | Redis / Upstash TLS URL | `rediss://default:<token>@host.upstash.io:6379` |
| `JWT_SECRET_KEY` | Yes | JWT signing secret (32+ chars) | — |
| `OPENAI_API_KEY` | Yes | OpenAI completions + embeddings | `sk-...` |
| `CELERY_BROKER_URL` | — | Celery broker (defaults to `REDIS_URL`) | — |
| `ENABLE_CELERY_INGESTION` | — | Async file indexing via Celery | `false` |
| `OPENAI_TIMEOUT_SECONDS` | — | OpenAI timeout | `45` |
| `OPENAI_FALLBACK_MODEL` | — | Fallback model on error | `gpt-4o-mini` |
| `AI_PER_USER_MAX_CONCURRENT` | — | Per-user AI concurrency cap | `2` |
| `AI_GLOBAL_MAX_CONCURRENT` | — | Global AI concurrency cap | `50` |
| `USE_PGVECTOR` | — | `0` forces FAISS locally | `1` |
| `SENTRY_DSN` | — | Backend Sentry | — |
| `RESEND_API_KEY` | — | Transactional email | — |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | — | Supabase file storage | — |
| `SAFEPAY_API_KEY` / `SAFEPAY_SECRET_KEY` | — | Safepay payments | — |

### Run database migrations

Migrations live in `backend/alembic/`. Run once before first start and after any schema change:

```bash
alembic upgrade head
```

This creates all tables, composite performance indexes, the `ai_usage` table,
the `document_chunks` table with a pgvector IVFFlat index, and enables the
`vector` extension.

### Verify infrastructure

```bash
python scripts/check_infra.py
# === Redis  ===  [OK]  ping=True  version=8.x
# === Postgres + pgvector  ===  [OK]  pgvector version=0.8.x
```

### Run the backend

```bash
python -m uvicorn main:app --reload
```

API: <http://localhost:8000>  Interactive docs: <http://localhost:8000/docs>

### Celery worker (optional)

Required only when `ENABLE_CELERY_INGESTION=true`.

```bash
celery -A app.features.ai_tutor.workers.celery_app:celery_app worker \
  --loglevel=info --concurrency=4 -Q celery,email,ingestion
```

## 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend boots at <http://localhost:5173> and proxies API calls to the backend.

### Frontend env

Create `frontend/.env.local`:

```
VITE_API_BASE_URL=http://localhost:8000
# VITE_SENTRY_DSN=<optional>
```

## 4. Docker (optional, full stack)

```bash
docker compose -f docker-compose.dev.yml up --build
```

This starts the backend, frontend, and a local Postgres instance.
Note: Docker Compose does **not** start a Celery worker by default.

## Common issues

- **`ModuleNotFoundError`** — re-activate the venv before running uvicorn.
- **CORS error in browser** — ensure `CORS_ALLOW_ORIGINS` includes your frontend URL.
- **Redis connection refused** — check `REDIS_URL` uses `rediss://` (double-s) for TLS; no surrounding quotes in `.env`.
- **pgvector not found** — run `CREATE EXTENSION IF NOT EXISTS vector;` on your Postgres database.
- **`alembic.ini not found`** — run `alembic upgrade head` from the `backend/` directory.
