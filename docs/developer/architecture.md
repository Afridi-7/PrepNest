# Architecture

PrepNest is a full-stack learning platform: a **FastAPI** backend, a **React + Vite** frontend, **Supabase PostgreSQL 17 + pgvector 0.8** for relational and vector data, and **Upstash Redis** for caching and async job queuing.

## High-level diagram

```
┌────────────────────┐          ┌──────────────────────────────────────────────┐
│  React 18 (Vite)   │  HTTPS   │   FastAPI 0.115  (uvicorn / Render)          │
│  TypeScript        │ ───────▶ │                                              │
│  Tailwind + shadcn │  JWT     │  Middleware stack                            │
│  TanStack Query    │          │   RequestID · GZip · CORS                    │
└────────────────────┘          │   SecurityHeaders · BodySizeLimit            │
        ▲                       │   GlobalRateLimit · CacheControl             │
        │ Static                │                                              │
        └── Vercel ─────────────│  Routers → Services → Repositories          │
                                │                                              │
                                │  ┌──────────────┐   ┌──────────────────┐    │
                                │  │  OpenAI API  │   │  Upstash Redis 8 │    │
                                │  │  gpt-4.1-mini│   │  (TLS rediss://) │    │
                                │  │  embed-3-sm  │   │  cache + Celery  │    │
                                │  └──────────────┘   └──────────────────┘    │
                                │                                              │
                                │  ┌───────────────────────────────────────┐  │
                                │  │  Supabase PostgreSQL 17 + pgvector 0.8│  │
                                │  │  (asyncpg, SSL, IVFFlat cosine index) │  │
                                │  └───────────────────────────────────────┘  │
                                └──────────────────────────────────────────────┘
                                         ▲  Celery worker (separate process)
                                         │  queues: celery, email, ingestion
```

## Repository layout

```
PrepNest/
├── backend/
│   ├── alembic/                # Alembic migration scripts
│   │   └── versions/
│   │       ├── 0001_initial.py
│   │       └── 0002_perf_indexes.py
│   ├── main.py                 # uvicorn entry
│   ├── app/
│   │   ├── main.py             # FastAPI app factory + middleware + Sentry init
│   │   ├── api/
│   │   │   ├── deps.py         # auth + DB session dependencies
│   │   │   ├── pagination.py   # Page[T], CursorPage[T], paginate() helper
│   │   │   └── routers/        # auth, chat, files, conversations, usat,
│   │   │                       # admin_content, admin_analytics, ...
│   │   ├── core/
│   │   │   ├── config.py       # pydantic-settings (reads .env)
│   │   │   ├── observability.py# Sentry lazy init
│   │   │   ├── rate_limit.py   # sliding-window rate limiter (Redis)
│   │   │   └── security.py     # JWT / bcrypt helpers
│   │   ├── db/
│   │   │   ├── models.py       # ORM: User, Conversation, Message, FileAsset,
│   │   │   │                   #      MCQ, AiUsage, DocumentChunk, ...
│   │   │   ├── session.py      # async engine, resolve_database_url (TLS)
│   │   │   └── repositories/   # data-access layer per model
│   │   ├── schemas/            # Pydantic v2 DTOs
│   │   ├── services/
│   │   │   ├── ai_concurrency.py   # per-user + global slot limiter (Redis)
│   │   │   ├── ai_usage_service.py # token tracking + daily quota
│   │   │   ├── cache_service.py    # Redis wrapper with in-memory fallback
│   │   │   ├── chat_service.py
│   │   │   ├── file_service.py     # upload + async ingestion trigger
│   │   │   ├── llm_service.py      # OpenAI (timeout, fallback, usage record)
│   │   │   └── pgvector_store.py   # cosine-similarity search (FAISS fallback)
│   │   └── features/
│   │       └── ai_tutor/
│   │           ├── rag/
│   │           │   ├── ingestion.py   # pgvector-first, FAISS fallback
│   │           │   └── retriever.py   # pgvector-first, FAISS fallback
│   │           └── workers/
│   │               ├── celery_app.py  # Celery app (Upstash broker)
│   │               ├── tasks.py       # ingest_file_task (retry + backoff)
│   │               └── email_tasks.py # send_verification, send_password_reset
│   ├── scripts/
│   │   └── check_infra.py     # live Redis + pgvector connectivity check
│   └── tests/
├── frontend/
│   └── src/
│       ├── App.tsx             # routes, QueryClient, ErrorBoundary
│       ├── components/
│       │   ├── ErrorBoundary.tsx
│       │   └── skeletons.tsx
│       ├── pages/
│       ├── services/api.ts     # typed fetch client
│       └── hooks/, lib/
├── load_tests/
│   ├── locustfile.py
│   └── README.md
├── docs/developer/
└── docker-compose*.yml
```

## Backend layers

1. **Routers** (`app/api/routers/*.py`) — thin HTTP handlers; one file per domain.
   Active routers: `auth`, `users`, `dashboard`, `mock_tests`, `usat`, `chat`, `ai_learning`, `files`, `conversations`, `admin_content`, `admin_analytics`, `query_room`, `payments`.
2. **Services** (`app/services/*.py`) — pure business logic. No FastAPI imports.
3. **Repositories** (`app/db/repositories/`) — SQLAlchemy async queries.
4. **Models** (`app/db/models.py`) — SQLAlchemy 2.0 ORM declarations.
5. **Schemas** (`app/schemas/*.py`) — Pydantic v2 DTOs.
6. **Core** (`app/core/`) — settings, structured logging, JWT/bcrypt, Sentry, rate limiting.

### Middleware stack (in order)

| Middleware | Purpose |
|---|---|
| `RequestIDMiddleware` | Assigns unique `X-Request-ID` per request |
| `GZipMiddleware` | Compresses responses ≥ 1 KB |
| `CORSMiddleware` | Allowlist + optional regex for preview deployments |
| `CacheControlMiddleware` | Adds `Cache-Control` headers |
| `SecurityHeadersMiddleware` | OWASP headers (CSP, HSTS, X-Frame-Options, ...) |
| `BodySizeLimitMiddleware` | Rejects oversized uploads |
| `GlobalRateLimitMiddleware` | Sliding-window limit per IP via Redis |
| `RequestContextMiddleware` | Thread-local request context |

### Request lifecycle

```
HTTP request
  → Middleware stack (rate-limit, CORS, security headers, ...)
  → Router endpoint
  → Pydantic validation (request schema)
  → Auth dependency (decode JWT, load user)
  → Service call (business logic)
     → AI concurrency limiter (Redis slots)   [AI endpoints only]
     → LLM service (OpenAI, timeout, fallback)
     → AI usage recording (ai_usage table)
  → Repository query (SQLAlchemy async + asyncpg)
  → Pydantic response schema
  → JSON
```

## Frontend architecture

- **React 18 + Vite + TypeScript**.
- **Tailwind CSS** with HSL CSS variables. Dark-mode driven by a `.dark` class.
- **shadcn/ui** primitives in `src/components/ui/`.
- **API client** in `src/services/api.ts` — typed methods backed by `fetch`.
- **Routing**: `react-router-dom` v6 with lazy-loaded route components in `App.tsx`.
- **State**: `@tanstack/react-query` with `staleTime=60s`, `gcTime=5min`, `retry=1`.
- **Error handling**: `ErrorBoundary` component wraps all Suspense boundaries; captures to Sentry if `window.Sentry` is present.
- **Loading states**: per-page skeleton components (`DashboardSkeleton`, `MCQListSkeleton`, `AITutorSkeleton`, ...) in `components/skeletons.tsx`.

## Authentication

- **Login** issues a JWT (HS256, 24 h default expiry).
- **Frontend** stores the token in `localStorage` and sends it as `Authorization: Bearer ...`.
- **Backend** validates via the `get_current_user` dependency in `api/deps.py`.
- Routes wrapped in `<RequireAuth>` redirect anonymous users to `/login`.

## AI / LLM flow

1. User asks a question in the AI Tutor interface.
2. Frontend POSTs to `/api/v1/chat/stream`.
3. `chat_service.py` acquires an AI concurrency slot (Redis) then calls `llm_service.py`.
4. `llm_service` calls OpenAI with a 45 s timeout; streams tokens back.
5. On error it retries with the fallback model (`gpt-4o-mini`).
6. After the stream ends, token usage is recorded to the `ai_usage` table.
7. The frontend renders tokens progressively.
8. Conversations and messages persist via the `conversations` router + repository.

## Document RAG pipeline

```
POST /files/upload
  → file_service.upload_and_index()
  → if ENABLE_CELERY_INGESTION=true:
      ingest_file_task.delay(file_id)       # Celery → Upstash queue
      return status="processing"
    else:
      inline ingestion (synchronous)
  → ingest worker:
      extract text → chunk → embed (OpenAI)
      → pgvector_store.add_documents()      # INSERT INTO document_chunks
      → fallback: FAISS vector_store
      → file_asset.status = "ready"

GET /files/{id}/status  → poll until status="ready"

AI query → retriever.retrieve()
  → pgvector cosine-similarity search      # SELECT ... ORDER BY embedding <=> query
  → fallback: FAISS similarity_search
  → top-k chunks injected into prompt
```

## Caching strategy

`cache_service.py` wraps Upstash Redis (TLS). Falls back to an in-process `asyncio.Lock`-based dict when Redis is unavailable.

| Cache key pattern | TTL | Content |
|---|---|---|
| `usat:categories` | 24 h | Category list |
| `usat:{cat}:subjects` | 24 h | Subject list per category |
| `user:{id}:profile` | 1 h | User profile |
| `site:settings` | 6 h | Global site settings |
| `rate:{ip}:{minute}` | 60 s | Sliding-window rate counter |

## Storage

Files are stored either on local disk (`backend/data/uploads/`) or Supabase Storage, abstracted via `services/file_service.py` → `services/supabase_storage.py`.

## Database schema highlights

Key tables added in the performance overhaul:

| Table | Purpose |
|---|---|
| `ai_usage` | Per-request model / token / latency logging |
| `document_chunks` | Embedded text chunks; `embedding vector(1536)` with IVFFlat index |
| `file_assets` | Tracks upload status (`pending` / `processing` / `ready` / `failed`) |

Indexes added in migration `0002_perf_indexes`:
- Composite indexes on `messages(conversation_id, created_at)`, `conversations(user_id, updated_at)`, `file_assets(user_id, status)`, `mcqs(topic_id, difficulty)`, `practice_results(user_id, created_at)`.

## Celery workers

Three queues routed via `task_routes` in `celery_app.py`:

| Queue | Tasks |
|---|---|
| `celery` | default / general tasks |
| `email` | `email.send_verification`, `email.send_password_reset` |
| `ingestion` | `ingest_file_task` |

Worker config: `task_acks_late=True`, `worker_prefetch_multiplier=1`, `worker_max_tasks_per_child=200`, soft time limit 300 s.

## Observability

- **Sentry**: initialised in `app/core/observability.py` via `init_sentry()` called at app startup. Integrates with Starlette, FastAPI, and SQLAlchemy. `traces_sample_rate=0.05`, `send_default_pii=False`.
- **Structured logging**: JSON-formatted request logs including `request_id`, `method`, `path`, `status_code`, `duration_ms`.
- **Load testing**: `load_tests/locustfile.py` with 5 user classes (`BrowsingUser`, `MCQUser`, `AITutorStreamUser`, `UploadUser`, `MockTestUser`).

## Build & deploy

- **Frontend**: `npm run build` → static `dist/` deployed to Vercel (`frontend/vercel.json` handles SPA rewrites).
- **Backend**: `Dockerfile` + `render.yaml` for Render. Pre-deploy command: `alembic upgrade head`.
