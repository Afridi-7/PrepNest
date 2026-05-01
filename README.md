# PrepNest

AI-powered exam-preparation platform for **USAT & HAT** students. Combines a React + TypeScript frontend with a FastAPI backend, pgvector semantic search, Redis caching, and Celery background workers.

---

## Features

- **AI Tutor** — streaming, context-aware tutor agent built on GPT-4.1-mini
- **Multi-agent system** — router, retriever, memory, live-search, and visualisation agents
- **USAT/HAT content** — subjects, topics, MCQs, notes, past papers, tips; admin upload panel
- **Mock tests** — timed full-length tests with analytics
- **Query Room** — community Q&A threaded discussion
- **Document RAG** — upload PDFs/images; pgvector cosine-similarity retrieval
- **Async upload pipeline** — Celery worker embeds and indexes files in the background
- **Redis caching** — namespaced caches (USAT content, user profiles, site settings) with TTL
- **AI safety** — per-user and global concurrency caps, usage tracking, model fallback, daily token quotas
- **Payments** — Safepay subscription checkout (PKR-native)
- **Roles** — student / admin; JWT-secured endpoints throughout

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | FastAPI 0.115, Python 3.11, SQLAlchemy 2 async, Pydantic v2 |
| Database | PostgreSQL 17 (Supabase) + pgvector 0.8 |
| Cache | Redis 8 (Upstash, TLS) |
| Background jobs | Celery 5.5 (broker + backend via Upstash Redis) |
| AI | OpenAI GPT-4.1-mini / text-embedding-3-small |
| Storage | Supabase Storage (production) / local disk (dev) |
| Migrations | Alembic |
| Payments | Safepay |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Observability | Sentry (backend + frontend optional), structured request-id logs |

---

## Project structure

```
PrepNest/
├── backend/
│   ├── alembic/                    # Migration scripts (run before starting)
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py             # Auth + DB session FastAPI dependencies
│   │   │   ├── pagination.py       # Page[T] envelope, cursor helpers
│   │   │   └── routers/            # auth, chat, files, conversations, usat,
│   │   │                           # admin_content, admin_analytics, ...
│   │   ├── core/
│   │   │   ├── config.py           # pydantic-settings (reads .env)
│   │   │   ├── observability.py    # Sentry init
│   │   │   └── security.py         # JWT / bcrypt helpers
│   │   ├── db/
│   │   │   ├── models.py           # SQLAlchemy ORM (User, Conversation,
│   │   │   │                       # Message, FileAsset, AiUsage, DocumentChunk, ...)
│   │   │   ├── session.py          # Async engine + SessionLocal
│   │   │   └── repositories/       # Data-access layer per model
│   │   ├── features/ai_tutor/
│   │   │   ├── rag/                # ingestion.py, retriever.py, vector_store (FAISS)
│   │   │   └── workers/            # Celery app, ingest tasks, email tasks
│   │   ├── schemas/                # Pydantic DTOs
│   │   └── services/
│   │       ├── ai_concurrency.py   # Per-user + global concurrency limiter
│   │       ├── ai_usage_service.py # Token usage logging + daily quotas
│   │       ├── cache_service.py    # Redis wrapper (in-memory fallback)
│   │       ├── llm_service.py      # OpenAI wrapper (timeout + fallback model)
│   │       ├── pgvector_store.py   # pgvector read/write (FAISS fallback)
│   │       └── file_service.py     # Upload + async ingestion trigger
│   ├── scripts/
│   │   └── check_infra.py          # Quick Redis + pgvector connectivity test
│   ├── tests/                      # pytest suite
│   ├── alembic.ini
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx                 # Routes, QueryClient, ErrorBoundary
│       ├── components/
│       │   ├── ErrorBoundary.tsx   # Route-level error boundary + Sentry
│       │   └── skeletons.tsx       # Loading skeletons (Dashboard, MCQ, ...)
│       ├── pages/
│       ├── services/api.ts         # Typed fetch client
│       └── hooks/, lib/
├── load_tests/
│   ├── locustfile.py               # 5 Locust user classes for soak tests
│   └── README.md
├── docs/developer/                 # Setup, architecture, API, testing guides
├── docker-compose.yml
├── docker-compose.dev.yml
└── render.yaml
```

---

## Local development

### Prerequisites

- Python 3.11+, Node 18+
- A Postgres database with pgvector enabled (`CREATE EXTENSION IF NOT EXISTS vector;`)
- A Redis instance — Upstash free tier, local Docker (`docker run -d --name redis -p 6379:6379 redis:7-alpine`), or Windows Redis

### 1 — Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in at minimum:

```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname?sslmode=require
REDIS_URL=rediss://default:<token>@<host>.upstash.io:6379
JWT_SECRET_KEY=<32+ random chars>
OPENAI_API_KEY=sk-...
```

> Note: do NOT wrap values in quotes inside `.env` — pydantic-settings reads them literally.

Run migrations, then start the server:

```bash
alembic upgrade head
python -m uvicorn main:app --reload
```

API: http://localhost:8000   Swagger UI: http://localhost:8000/docs

**Verify infrastructure:**

```bash
python scripts/check_infra.py
# === Redis  (rediss://...) ===
#   [OK]  ping=True  version=8.2.0
# === Postgres + pgvector  (postgresql://...) ===
#   [OK]  PostgreSQL 17.x
#   [pgvector OK]  extension version=0.8.0
```

### 2 — Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Create `frontend/.env.local`:

```
VITE_API_BASE_URL=http://localhost:8000
```

### 3 — Celery worker (optional, required for async file ingestion)

```bash
cd backend
celery -A app.features.ai_tutor.workers.celery_app:celery_app worker \
  --loglevel=info --concurrency=4 -Q celery,email,ingestion
```

Set `ENABLE_CELERY_INGESTION=true` in `.env` to activate the async upload pipeline.
Without the worker, uploads still work synchronously (inline ingestion).

### 4 — Docker (full stack)

```bash
docker compose -f docker-compose.dev.yml up --build
```

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | asyncpg Postgres URL |
| `REDIS_URL` | Yes | — | Redis / Upstash TLS URL (no quotes) |
| `JWT_SECRET_KEY` | Yes | — | JWT signing secret (32+ chars) |
| `OPENAI_API_KEY` | Yes | — | OpenAI completions + embeddings |
| `CELERY_BROKER_URL` | — | same as `REDIS_URL` | Celery broker |
| `CELERY_RESULT_BACKEND` | — | same as `REDIS_URL` | Celery results |
| `ENABLE_CELERY_INGESTION` | — | `false` | Async file processing via Celery |
| `OPENAI_TIMEOUT_SECONDS` | — | `45` | OpenAI client timeout |
| `OPENAI_FALLBACK_MODEL` | — | `gpt-4o-mini` | Model used after primary model fails |
| `AI_PER_USER_MAX_CONCURRENT` | — | `2` | Per-user AI request concurrency cap |
| `AI_GLOBAL_MAX_CONCURRENT` | — | `50` | Global AI concurrency cap |
| `AI_LEASE_SECONDS` | — | `120` | Concurrency slot TTL |
| `USE_PGVECTOR` | — | `1` | Set `0` to force FAISS locally |
| `SENTRY_DSN` | — | (unset) | Backend Sentry error tracking |
| `VITE_SENTRY_DSN` | — | (unset) | Frontend Sentry error tracking |
| `RESEND_API_KEY` | — | — | Transactional email (Resend) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | — | — | Supabase file storage |
| `SAFEPAY_API_KEY` / `SAFEPAY_SECRET_KEY` | — | — | Safepay payment integration |

See `.env.example` for the complete list.

---

## API reference (key endpoints)

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| GET | `/api/v1/auth/me` | Current user |

### Chat / AI Tutor

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/chat/stream` | Streaming AI response (SSE) |
| GET | `/api/v1/conversations` | List conversations (offset+limit) |
| GET | `/api/v1/conversations/page` | Paginated Page[T] envelope |
| GET | `/api/v1/conversations/{id}` | Full conversation with messages |

### Files

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/files/upload` | Upload PDF / image; returns immediately |
| GET | `/api/v1/files/{id}/status` | Poll ingestion status (pending / processing / ready / failed) |

### USAT content

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/usat/categories` | USAT category list |
| GET | `/api/v1/usat/{category}/subjects` | Subjects for a category |
| GET | `/api/v1/topics/{id}/mcqs` | MCQs for a topic |
| GET | `/api/v1/subjects/{id}/materials` | Notes and resources |
| GET | `/api/v1/subjects/{id}/past-papers` | Past papers |

### Admin

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/admin/mcqs` | Create MCQ |
| POST | `/api/v1/admin/materials` | Create material / note |
| GET | `/api/v1/admin/analytics/ai-usage` | 30-day AI token usage per model |

Full interactive reference: http://localhost:8000/docs

---

## Running tests

```bash
# Backend unit + integration tests
cd backend
pytest

# Frontend unit tests (Vitest)
cd frontend
npm run test

# E2E tests (Playwright)
cd frontend
npx playwright test
```

**Load tests** (`pip install "locust>=2.27"` required):

```bash
$env:LOCUST_TOKEN = "<JWT>"
locust -f load_tests/locustfile.py --host http://localhost:8000
# open http://localhost:8089 for the web UI
```

---

## Deployment

### Backend on Render

1. Connect repo; set **Root Directory** to `backend`.
2. **Pre-Deploy Command**: `alembic upgrade head`
3. **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add all required env vars in Render dashboard.
5. pgvector is enabled by default on Render Postgres; Upstash Redis free tier works out of the box.

### Frontend on Vercel

1. Connect repo; set **Root Directory** to `frontend`.
2. Add `VITE_API_BASE_URL=https://<your-render-app>.onrender.com`.
3. `vercel.json` already handles SPA rewrites.

---

## Security

- Passwords hashed with bcrypt (passlib)
- JWTs signed HS256; 24 h lifetime by default
- All remote Postgres connections forced to TLS (`sslmode=require`)
- Redis uses `rediss://` (TLS) with Upstash in production
- CORS allowlist enforced; optional regex for Vercel preview deployments
- OWASP security headers via `SecurityHeadersMiddleware`
- Per-IP and per-user rate limiting on all sensitive endpoints
- AI concurrency + daily token quota enforcement prevents runaway spend

---

## License

Proprietary — all rights reserved.