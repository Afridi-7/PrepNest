# Architecture

PrepNest is a full-stack learning platform: a **FastAPI** backend, a **React + Vite** frontend, and a **PostgreSQL** database. AI tutoring is layered on top via an LLM service.

## High-level diagram

```
┌────────────────────┐          ┌──────────────────────┐          ┌──────────────┐
│  React (Vite, TS)  │  HTTPS   │   FastAPI (async)    │   asyncpg │ PostgreSQL  │
│  Tailwind + shadcn │ ───────▶ │  Routers / Services  │ ───────▶ │  + pgvector │
│  next-themes       │  JWT     │   SQLAlchemy 2.x     │           └──────────────┘
└────────────────────┘          │   Pydantic v2        │          ┌──────────────┐
        ▲                       │   LLM service ───────┼─────────▶│  OpenAI API │
        │ Static                │   Storage service ───┼─────────▶│  Supabase   │
        └─── Vercel / Nginx ────┴──────────────────────┘           └──────────────┘
```

## Repository layout

```
PrepNest/
├── backend/
│   ├── main.py                 # uvicorn entry
│   ├── app/
│   │   ├── main.py             # FastAPI app factory + middleware
│   │   ├── api/
│   │   │   ├── deps.py         # auth + DB session dependencies
│   │   │   └── routers/        # one router per domain
│   │   ├── core/               # config, logging, security (JWT/bcrypt)
│   │   ├── db/                 # SQLAlchemy models, session, repositories
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── services/           # business logic (chat, llm, storage, …)
│   │   └── features/           # feature-specific modules (ai_tutor)
│   └── tests/                  # pytest suite
├── frontend/
│   └── src/
│       ├── pages/              # route components
│       ├── components/ui/      # shadcn primitives
│       ├── services/api.ts     # typed API client
│       ├── hooks/, lib/        # shared hooks + utilities
│       └── docs/user/          # user-facing markdown content
├── docs/
│   ├── developer/              # this folder
│   └── user/                   # mirror of frontend/src/docs/user
└── docker-compose*.yml
```

## Backend layers

1. **Routers** (`app/api/routers/*.py`) — thin HTTP handlers; one file per domain (`auth`, `users`, `dashboard`, `mock_tests`, `usat`, `chat`, `ai_learning`, `files`, `conversations`, `admin_content`).
2. **Services** (`app/services/*.py`) — pure business logic. Reusable, testable, no FastAPI imports.
3. **Repositories** (`app/db/repositories/`) — data access. Encapsulate SQLAlchemy queries.
4. **Models** (`app/db/models.py`) — SQLAlchemy ORM declarations.
5. **Schemas** (`app/schemas/*.py`) — Pydantic v2 DTOs for input/output validation.
6. **Core** (`app/core/`) — settings (`config.py`), structured logging, JWT + password hashing.

### Request lifecycle

```
HTTP request
  → CORS / rate-limit middleware
  → Router endpoint
  → Pydantic validation (request schema)
  → Auth dependency (decode JWT, load user)
  → Service call (business logic)
  → Repository query (SQLAlchemy async)
  → Pydantic response schema
  → JSON
```

## Frontend architecture

- **React 18 + Vite + TypeScript**.
- **Tailwind CSS** with HSL CSS variables in `src/index.css`. Dark-mode driven by a `.dark` class controlled by `next-themes`.
- **shadcn/ui** primitives in `src/components/ui/`.
- **API client** in `src/services/api.ts` exposes typed methods backed by `fetch`.
- **Routing**: `react-router-dom` v6 with lazy-loaded route components in `App.tsx`.
- **State**: per-page React hooks; `@tanstack/react-query` available for cached fetches.

## Authentication

- **Login** issues a JWT (HS256, configurable expiry).
- **Frontend** stores the token in `localStorage` and sends it via `Authorization: Bearer …`.
- **Backend** validates via the `get_current_user` dependency in `api/deps.py`.
- Routes wrapped in `<RequireAuth>` redirect anonymous users to `/login`.

## AI / LLM flow

1. User asks a question in `AITutor.tsx`.
2. Frontend posts to `/ai/chat` (or similar).
3. `chat_service.py` builds the prompt and calls `llm_service.py`.
4. `llm_service` streams tokens back; the frontend renders progressively.
5. Conversations persist via `conversations.py` router + repository.

## Storage

Files (uploads, generated visuals) are stored either on local disk (`backend/data/uploads/`) or Supabase Storage, abstracted behind `services/storage_service.py` and `services/supabase_storage.py`.

## Build & deploy

- **Frontend**: `npm run build` → static `dist/` deployed to Vercel/Nginx (`frontend/Dockerfile`, `frontend/vercel.json`).
- **Backend**: `Dockerfile` + `render.yaml` for Render.com, or `docker-compose.yml`.
