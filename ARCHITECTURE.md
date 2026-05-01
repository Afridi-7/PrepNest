# PrepNest — System Architecture & Design Review Document

> **Purpose:** This document describes the full technical architecture of PrepNest in enough depth for experienced software engineers to evaluate scalability, performance, code quality, and security. All observations are drawn directly from the source code.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture Diagram](#2-high-level-architecture-diagram)
3. [Technology Stack](#3-technology-stack)
4. [Backend Architecture](#4-backend-architecture)
   - 4.1 [Entry Point & Application Bootstrap](#41-entry-point--application-bootstrap)
   - 4.2 [API Layer](#42-api-layer)
   - 4.3 [Authentication & Authorization](#43-authentication--authorization)
   - 4.4 [Database Layer](#44-database-layer)
   - 4.5 [Caching Layer](#45-caching-layer)
   - 4.6 [Rate Limiting & Quota System](#46-rate-limiting--quota-system)
   - 4.7 [AI Pipeline — Multi-Agent System](#47-ai-pipeline--multi-agent-system)
   - 4.8 [RAG (Retrieval-Augmented Generation)](#48-rag-retrieval-augmented-generation)
   - 4.9 [File Storage](#49-file-storage)
   - 4.10 [Email Service](#410-email-service)
   - 4.11 [Payment Integration](#411-payment-integration)
   - 4.12 [Background Tasks](#412-background-tasks)
5. [Data Model](#5-data-model)
6. [Frontend Architecture](#6-frontend-architecture)
   - 6.1 [Routing & Code Splitting](#61-routing--code-splitting)
   - 6.2 [State Management & Data Fetching](#62-state-management--data-fetching)
   - 6.3 [UI Component System](#63-ui-component-system)
   - 6.4 [Pages Inventory](#64-pages-inventory)
7. [Subscription & Monetisation Model](#7-subscription--monetisation-model)
8. [Security Design](#8-security-design)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Performance Characteristics](#10-performance-characteristics)
11. [Current Scalability Assessment](#11-current-scalability-assessment)
12. [Known Gaps & Improvement Recommendations](#12-known-gaps--improvement-recommendations)

---

## 1. Project Overview

**PrepNest** is an AI-powered study platform targeting students preparing for competitive exams (primarily USAT — University of Science and Arts Thailand entrance, and general academic prep). It combines structured study content with a multi-agent AI tutor, practice MCQs, mock tests, past papers, and a community query room.

**Core user-facing features:**

| Feature | Description |
|---|---|
| AI Tutor | Streaming chat with a multi-agent LLM pipeline |
| USAT Content Hub | Subjects → Topics → Materials, Notes, Past Papers, Resources |
| Practice MCQs | Subject/topic filtered multiple-choice question sets |
| Mock Tests | Timed full-length mock exams |
| Query Room | Q&A community-style discussion board |
| File Upload | Users attach PDFs/images to AI Tutor conversations |
| Pricing / Pro | Monthly subscription via Safepay (PKR) |
| Admin Panel | Content management (subjects, topics, MCQs, notes, etc.) |

---

## 2. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                                  │
│                                                                       │
│   Browser                                                             │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │  React 18 + TypeScript (Vite)                                │  │
│   │  TanStack Query  │  React Router v6  │  Tailwind + Radix UI  │  │
│   └──────────────────────┬───────────────────────────────────────┘  │
│                           │  HTTPS / REST + SSE (streaming)          │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────────┐
│                     API GATEWAY / CDN TIER                           │
│                                                                       │
│   Render Load Balancer (X-Forwarded-For)                             │
│   Vercel Edge (frontend static assets + CDN)                         │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                      APPLICATION TIER                                │
│                                                                       │
│   FastAPI (Python 3.13, asyncio)   Uvicorn ASGI                     │
│   ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────────┐  │
│   │  Auth    │  │  Chat    │  │  Content   │  │  Admin/Payments │  │
│   │  Router  │  │  Router  │  │  Routers   │  │  Routers        │  │
│   └────┬─────┘  └────┬─────┘  └─────┬──────┘  └────────┬────────┘  │
│        │              │              │                   │            │
│   ┌────▼──────────────▼──────────────▼───────────────────▼────────┐ │
│   │                   Service Layer                                │ │
│   │  ChatService │ AILearningService │ MockTestService │ ...       │ │
│   └────┬──────────────┬──────────────────────────────────────────┘ │
│        │              │                                              │
│   ┌────▼──────┐  ┌────▼───────────────────────────────────────────┐ │
│   │  LLM      │  │      Multi-Agent AI Pipeline                   │ │
│   │  Service  │  │  RouterAgent → [Retriever | LiveData |         │ │
│   │ (OpenAI)  │  │  Memory | Visualization] → TutorAgent          │ │
│   └───────────┘  └──────────────────┬─────────────────────────────┘ │
│                                      │                               │
└──────────────────────────────────────┼───────────────────────────────┘
                                       │
┌──────────────────────────────────────┼───────────────────────────────┐
│                      DATA TIER                                       │
│                                                                       │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│   │  PostgreSQL  │  │  Redis       │  │  FAISS Vector Store       │  │
│   │  (primary DB)│  │  (cache +    │  │  (local disk, .faiss +    │  │
│   │  SQLAlchemy  │  │   rate limit)│  │   .pkl metadata)          │  │
│   │  + asyncpg   │  │              │  │                            │  │
│   └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                       │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │  Supabase Storage (file uploads)  /  Local disk (dev)        │   │
│   └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘

External Services:  OpenAI API  │  Safepay  │  Resend (email)  │  Google OAuth
```

---

## 3. Technology Stack

### Backend

| Concern | Choice | Notes |
|---|---|---|
| Language | Python 3.13 | |
| Web Framework | FastAPI 0.115 | ASGI, full async |
| ASGI Server | Uvicorn + standard extras | Proxy-header aware |
| ORM | SQLAlchemy 2.0 (async) | Declarative mapped columns |
| Raw DB Pool | asyncpg 0.30 | Used for performance-critical raw queries |
| Primary Database | PostgreSQL 15 | |
| Dev Database | SQLite + aiosqlite | Fallback when PG not configured |
| Cache / Rate Limit | Redis (redis-py async) | In-memory fallback when Redis is down |
| LLM Provider | OpenAI (gpt-4.1-mini / gpt-4o-mini) | Async client |
| Embeddings | text-embedding-3-small (OpenAI) | dim=1536, stored as float32 |
| Vector Search | FAISS (faiss-cpu) | IndexFlatIP, disk-persisted |
| Auth | JWT HS256 (python-jose) + bcrypt + Google OAuth | |
| Background Tasks | Celery 5.5 | Worker not yet extensively used |
| File Storage | Supabase Storage (prod) / local disk (dev) | |
| Email | Resend API | SMTP fallback |
| Payments | Safepay (HMAC-SHA256 webhook verification) | PKR |
| PDF Parsing | pypdf 5.4 | |
| Validation | Pydantic v2 + pydantic-settings | |

### Frontend

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript | Strict mode |
| Framework | React 18 | Concurrent features |
| Build Tool | Vite 5 | ESM, HMR |
| Routing | React Router v6 | Lazy loaded routes |
| Server State | TanStack Query v5 | staleTime=60s, gcTime=5m |
| UI Components | Radix UI primitives + shadcn/ui | Accessible |
| Styling | Tailwind CSS v3 | Dark mode via next-themes |
| Animation | Framer Motion | |
| AI Response Rendering | react-markdown + remark-gfm | |
| Unit Tests | Vitest | |
| E2E Tests | Playwright | |

---

## 4. Backend Architecture

### 4.1 Entry Point & Application Bootstrap

`backend/main.py` → `backend/app/main.py`

On startup the application:
1. Initialises the asyncpg connection pool (`init_pg_pool`)
2. Connects to Redis (`cache_service.connect`)
3. Runs SQLAlchemy `create_all` to apply schema migrations
4. Seeds default content if the database is empty

On shutdown it drains both the PG pool and the Redis connection.

The application is configured entirely via environment variables through `pydantic-settings` (`app/core/config.py`). Settings are cached with `@lru_cache` so the `.env` file is parsed only once per process.

### 4.2 API Layer

All routes are mounted under `/api/v1`. The router tree:

```
/api/v1
├── /auth          → registration, login, Google OAuth, email verify, password reset
├── /users         → profile read/update
├── /chat          → AI chat (non-streaming + streaming SSE)
├── /conversations → conversation CRUD and message history
├── /files         → file upload, status, download
├── /usat          → subjects, topics, materials, MCQs, notes, resources, past papers
├── /ai-learning   → AI-powered explain / generate questions endpoints
├── /mock-tests    → test generation and submission
├── /query-room    → community questions and answers
├── /payments      → checkout, webhook, subscription status
├── /dashboard     → aggregated stats for the logged-in user
├── /admin/content → admin CRUD for all content types
├── /site          → public site settings (social links, etc.)
└── /health        → health-check (used by Render)
```

Each router is a separate file under `app/api/routers/`. FastAPI's `APIRouter` dependency injection is used throughout.

### 4.3 Authentication & Authorization

**Flow:**

```
Signup → bcrypt hash (SHA256 pre-hash for >72-byte safety) → DB
       → Resend verification email → token stored in users table
       
Login → verify password → create HS256 JWT (exp = 24h) → return token

Every protected endpoint → OAuth2PasswordBearer extracts Bearer token
                         → decode_access_token validates exp, iat, sub
                         → UserRepository.get_by_id loads user
                         → injects User into handler
```

**Google OAuth:**  
`POST /auth/google` accepts a Google `id_token`, verifies it against `https://oauth2.googleapis.com/tokeninfo`, upserts the user (creating one if first login), and returns a PrepNest JWT. This avoids storing a Google client secret on the client.

**Password Security:**
- Minimum 10 characters; must contain uppercase, lowercase, digit, special character
- Passwords are SHA-256 pre-hashed before bcrypt to avoid the 72-byte bcrypt truncation vulnerability
- Password-reset tokens are random 32-byte URL-safe strings; only the SHA-256 hash is stored in the DB
- Tokens expire in 30 minutes; the generic "If that email is registered…" response prevents email enumeration

**Authorization levels:**
- `get_current_user` — any authenticated user
- `is_user_pro(user)` — checks `user.is_pro` and `subscription_expires_at`
- `get_current_admin` — checks `user.is_admin`

### 4.4 Database Layer

**Dual-driver design:**

| Driver | Purpose |
|---|---|
| `SQLAlchemy 2.0 async` | ORM reads/writes via `async_session_factory` in service layer |
| `asyncpg` raw pool | Performance-critical raw SQL, used in pg_pool for high-throughput paths |

**Connection pool** (`app/db/pg_pool.py`):
- `min_size = max(2, cpu_count)`
- `max_size = max(20, min(50, cpu_count × 5))`
- Auto-scales to CPU topology

**Session management:**  
`get_db_session` is a FastAPI dependency that yields an `AsyncSession` scoped to the request. Sessions are committed or rolled back automatically.

**Database routing** (`app/db/session.py`):  
Supports a `DB_RESOLVER` environment variable allowing runtime DB switching (useful for read-replica routing or multi-tenant).

**Schema:** All tables use UUIDs as primary keys for Users, Conversations, Messages, and FileAssets (prevents enumeration). Content tables (Subject, Topic, MCQ, etc.) use auto-increment integers.

### 4.5 Caching Layer

`app/services/cache_service.py` — `CacheService` singleton

**Behaviour:**
- When Redis is reachable: uses `redis.asyncio` with TTL-keyed JSON blobs
- When Redis is unavailable: silently degrades to an in-process `dict` with expiry metadata (no crash, no data loss)
- `delete_pattern(prefix)` uses `SCAN` + `UNLINK` (non-blocking) on Redis; walks the in-memory dict under an `asyncio.Lock` otherwise

**Cached objects:**
- Dashboard aggregate stats (TTL = 5 min)
- Site settings (invalidated on admin write)
- USAT content listings (invalidated on admin write)
- Rate-limit counters (sliding window + hourly INCR buckets)

### 4.6 Rate Limiting & Quota System

Three complementary layers, all Redis-backed with in-memory fallback:

| Layer | Scope | Limit | Where enforced |
|---|---|---|---|
| Per-minute sliding window | Per user ID (or IP for anon) | Configurable per endpoint | `rate_limit()` dependency in `deps.py` |
| Per-hour INCR bucket | Per authenticated user | 20 requests/hour | `check_rate_limit(20, "chat_ai")` in chat router |
| Per-day quota | Per authenticated user | 500 AI calls/day | `daily_quota(500, "ai")` dependency |
| Free-tier message limit | Per user | 5 AI messages/day | `_enforce_daily_message_limit()` in chat router |

Rate-limit bucket keys prefer user ID over IP to survive NAT (many users sharing one office IP). `X-Forwarded-For` is trusted only when `TRUST_PROXY_HEADERS=true` in config (set in production on Render, not in dev).

When Redis is unavailable, rate limiting fails **open** (request allowed through), logged as a warning. This is a conscious trade-off: availability over strict limiting during a Redis outage.

### 4.7 AI Pipeline — Multi-Agent System

The AI Tutor is implemented as a pipeline of specialised agents coordinated by `AgentOrchestrator`.

```
User Message
     │
     ▼
┌─────────────┐    JSON classification
│ RouterAgent │ ──────────────────────────────────────────────┐
│  (gpt-4o-   │  use_retriever │ use_live_data │ use_database │
│   mini)     │  use_visualization │ detected_mode            │
└─────────────┘                                               │
                                                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Parallel Context Fetch                    │
│                                                              │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │ RetrieverAgent│  │  LiveDataAgent  │  │  MemoryAgent  │  │
│  │ FAISS vector  │  │  Wikipedia API  │  │  Recent msgs  │  │
│  │ + DB keyword  │  │  + web search   │  │  from conv.   │  │
│  └──────────────┘  └─────────────────┘  └───────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ DatabaseContextAgent (inline in orchestrator)       │    │
│  │ Parallel: Materials + MCQs + Topics + Subjects      │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────┘
                                 │ merged context
                                 ▼
                       ┌──────────────────┐
                       │   TutorAgent     │
                       │  (gpt-4.1-mini)  │
                       │  Streaming SSE   │
                       └────────┬─────────┘
                                │
                    ┌───────────▼──────────┐
                    │ VisualizationAgent   │  (only if requested)
                    │ matplotlib / mermaid │
                    └──────────────────────┘
```

**Key design decisions:**
- `RouterAgent` uses a cheap model (`gpt-4o-mini`, temperature=0) for pure classification, saving cost on every request before generation starts
- `TutorAgent` uses the more capable `gpt-4.1-mini`
- Context agents run concurrently via `asyncio.gather` — no sequential blocking
- The orchestrator exposes both a non-streaming `run()` and a streaming `run_stream()` generator (SSE)
- If the LLM key is not configured, a graceful fallback message is returned (no crash)

**Learning levels:** The system accepts `learning_level` per message (`beginner`, `intermediate`, `advanced`) which is injected into the tutor system prompt.

### 4.8 RAG (Retrieval-Augmented Generation)

`app/features/ai_tutor/rag/`

**Vector Store:** FAISS `IndexFlatIP` (inner product = cosine similarity for normalised vectors)
- Dimension: 384 (configurable)
- Persistence: `.faiss` index + `.pkl` metadata on local disk
- Embeddings: `text-embedding-3-small` via OpenAI (1536-dim actual, stored at configured dim)

**Ingestion pipeline** (`ingestion.py`):
1. Load document (PDF via pypdf, or plain text)
2. Chunk with overlap (`chunking.py`)
3. Embed chunks via `LLMService.embed_texts`
4. Add to FAISS index + metadata store
5. Persist to disk

**Retrieval** (`retriever.py`):
- Top-K = 5 (configurable)
- Returns chunk text + metadata (source, page, score)
- Used by `RetrieverAgent` to build context for the TutorAgent

**Fallback:** When FAISS is unavailable (import error), the system falls back to numpy cosine similarity — no hard crash.

### 4.9 File Storage

Dual-mode storage (`app/services/storage_service.py`):

| Mode | Mechanism | When Used |
|---|---|---|
| `local` | Writes to `./data/uploads/` | Development |
| `supabase` | Uploads to Supabase Storage bucket | Production |

`SUPABASE_URL` + `SUPABASE_SERVICE_KEY` environment variables activate cloud storage. Uploaded files are keyed as `{user_id}/{conversation_id}/{filename}`. Max upload size is enforced server-side before sending to storage (default 100 MB).

Files attached to conversations are ingested into the FAISS vector store so the AI Tutor can answer questions about uploaded documents.

### 4.10 Email Service

`app/services/email_service.py`

- Primary: Resend API (`RESEND_API_KEY`)
- Fallback: SMTP (configurable `SMTP_HOST`, `SMTP_PORT`, etc.)
- Emails sent: account verification, password reset

Both paths are `async` via `httpx`/`asyncio`. Email send failures are caught and logged (they do not abort the registration flow — the user can request resend).

### 4.11 Payment Integration

`app/services/payment_service.py` — Safepay (Pakistani payment gateway)

**Checkout flow:**
1. Frontend calls `POST /payments/checkout` with `plan_code`
2. Backend resolves price from `app/core/plans.py` server-side (never trusts client price)
3. Creates a Safepay order via REST API, returns `checkout_url`
4. User is redirected to Safepay hosted checkout
5. Safepay sends HMAC-SHA256 signed webhook to `POST /payments/webhook`
6. Backend verifies signature with `hmac.compare_digest` (constant-time)
7. On success: sets `user.is_pro = True` and `subscription_expires_at = now + plan.interval_days`

**Sandbox mode:** When `SAFEPAY_API_KEY` is not configured, the service returns a deterministic mock tracker so the local payment UI flow is testable without hitting Safepay servers.

**Plan catalogue** (`app/core/plans.py`):
- Single plan: `pro_monthly` — PKR 850/month (30 days)
- Prices stored in integer paisa (PKR × 100) to avoid floating-point rounding
- Changing the price requires only editing the dict and restarting; no DB migration needed

### 4.12 Background Tasks

**Celery** is installed (`celery==5.5.1`) but used minimally at this stage. Potential use cases configured:
- Async email dispatch
- Document ingestion after file upload
- Scheduled content indexing

Currently most async work is done with `asyncio` within the request lifecycle. Celery is the foundation for moving heavier jobs out of the request path when needed.

---

## 5. Data Model

```
users
  id (UUID PK) | email | password_hash | full_name | is_active | is_admin
  is_pro | subscription_expires_at | granted_by_admin | is_verified
  google_id | verification_token | reset_password_token_hash
  reset_password_token_expires_at | preferences (JSON) | created_at
  │
  ├─── conversations (1:N)
  │       id (UUID) | user_id (FK) | title | metadata_json | created_at | updated_at
  │       │
  │       ├─── messages (1:N)
  │       │       id (UUID) | conversation_id (FK) | role | content (Text)
  │       │       token_count | metadata_json | created_at
  │       │
  │       └─── file_assets (1:N)
  │               id (UUID) | conversation_id (FK) | user_id (FK)
  │               filename | content_type | storage_path | status | metadata_json
  
subjects
  id (int PK) | name | exam_type | created_at
  │
  └─── topics (1:N)
          id (int PK) | title | subject_id (FK) | created_at
          │
          ├─── materials (1:N)   id | title | content (Text) | type
          ├─── mcqs (1:N)        id | question | option_a/b/c/d | correct_answer | explanation
          ├─── resources (1:N)   id | title | url | chapter_id (FK)
          └─── notes (1:N)       id | title | content | subject_id | chapter_id

tips             id | title | content | subject_id (FK)
past_papers      id | title | year? | subject_id | file_url | ...
site_settings    id ("default") | instagram_url | facebook_url | youtube_url | ...
```

**Relationships summary:**
- Users own Conversations (CASCADE DELETE)
- Conversations own Messages and FileAssets (CASCADE DELETE)
- Subjects own Topics (CASCADE DELETE)
- Topics own Materials, MCQs, Resources, Notes (CASCADE DELETE)

---

## 6. Frontend Architecture

### 6.1 Routing & Code Splitting

Every page is `React.lazy()` wrapped — they are separate JS chunks loaded on demand. This keeps the initial bundle small. React Router v6 `<Routes>` maps URLs to lazy page components inside a `<Suspense>` boundary.

Route protection: A `PrivateRoute` wrapper checks the auth token from local storage / TanStack Query cache. Unauthenticated access to protected pages redirects to `/login`.

`ScrollToTop` component subscribes to `useLocation` and calls `window.scrollTo(0,0)` on each navigation — simple but effective UX.

### 6.2 State Management & Data Fetching

**TanStack Query v5** is the primary server-state manager:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,       // data fresh for 60 s
      gcTime: 5 * 60_000,      // kept in memory 5 min after unmount
      refetchOnWindowFocus: false,
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000), // exponential backoff
    },
    mutations: { retry: 0 },
  },
});
```

All API calls go through `src/services/api.ts` (`apiClient`) which:
- Attaches the Bearer JWT from storage to every request
- Returns typed response objects
- Handles 401 by clearing auth state

Local UI state (modal open/close, form state) uses React `useState` / `useReducer`. No global client-state library (Redux, Zustand) — TanStack Query handles all server state, which is the majority.

### 6.3 UI Component System

- **Radix UI** primitives provide accessible, unstyled base components (Alert Dialog, Label, Slot, Toast, Tooltip)
- **shadcn/ui** conventions for composing styled components from Radix + Tailwind
- **Tailwind CSS** for utility-first styling
- **next-themes** for dark/light mode with system preference detection
- **Framer Motion** for page transitions and micro-animations
- **react-markdown + remark-gfm** for rendering AI responses (including tables, code blocks, lists)
- **Sonner** (toast notifications) + Radix Toast (legacy)
- **lucide-react** icon library

### 6.4 Pages Inventory

| URL | Page | Auth Required | Pro Required |
|---|---|---|---|
| `/` | Index (landing) | No | No |
| `/login` | Login | No | No |
| `/signup` | Signup | No | No |
| `/forgot-password` | ForgotPassword | No | No |
| `/reset-password` | ResetPassword | No | No |
| `/verify-email` | VerifyEmail | No | No |
| `/dashboard` | Dashboard | Yes | No |
| `/usat` | USAT hub | Yes | No |
| `/usat/:subjectId` | USATSubjects | Yes | No |
| `/usat/:subjectId/:topicId` | USATSubjectChapters | Yes | No |
| `/practice` | Practice MCQs | Yes | No |
| `/ai-tutor` | AI Tutor chat | Yes | Partial (5 msg/day free) |
| `/mock-test` | Mock Test | Yes | No |
| `/query-room` | Query Room | Yes | No |
| `/pricing` | Pricing | No | No |
| `/billing/success` | BillingSuccess | Yes | No |
| `/billing/cancel` | BillingCancel | Yes | No |
| `/admin/content` | Admin Panel | Yes | Admin only |
| `/docs` | Documentation | No | No |
| `/contact` | Contact | No | No |
| `/privacy-policy` | Privacy Policy | No | No |
| `/terms-of-service` | Terms of Service | No | No |
| `/refund-policy` | Refund Policy | No | No |

---

## 7. Subscription & Monetisation Model

```
Free Tier:
  - Full USAT content access
  - 5 AI Tutor messages per day
  - Practice MCQs (limited)
  - Mock tests

Pro Monthly (PKR 850 / month):
  - Unlimited AI Tutor messages
  - Priority AI responses
  - All content
  - 30-day access from payment date

Admin grants:
  - Admin can set is_pro=True with granted_by_admin=True
  - Used for beta users / influencers / manual activations
  - Not tied to Safepay — bypasses payment entirely
```

**Subscription check in code:**
```python
def is_user_pro(user: User) -> bool:
    if not user.is_pro:
        return False
    if user.granted_by_admin:
        return True  # admin grants don't expire
    if user.subscription_expires_at and user.subscription_expires_at > datetime.now(timezone.utc):
        return True
    return False
```

---

## 8. Security Design

### Authentication
- JWT HS256, 24-hour expiry, validated on every request
- `iat` claim stored to support future token revocation
- Google OAuth via server-side token verification (no client secret exposure)

### Password Handling
- SHA-256 pre-hash before bcrypt (prevents 72-byte truncation vulnerability)
- bcrypt work factor auto-calibrated by passlib
- Reset tokens: random 32-byte URL-safe string, SHA-256 hashed in DB, 30-minute expiry
- Email enumeration prevention: password reset always returns the same message

### Input Validation
- All request bodies validated via Pydantic v2 schemas
- File upload size enforced before reading into memory
- SQL injection not possible (SQLAlchemy ORM parameterised queries throughout)

### Webhook Security
- Safepay webhooks verified with `hmac.compare_digest` (constant-time, prevents timing attacks)
- Webhook secret never logged or included in responses

### Rate Limiting
- Multi-layer: per-minute, per-hour, per-day, per-tier
- Fails open on Redis outage (availability > strict limiting)

### CORS
- Origins controlled by `CORS_ORIGINS` / `CORS_ORIGIN_REGEX` env vars
- Dev defaults are permissive; production requires explicit origin list

### PII Protection
- Email addresses masked in all log lines (`j***e@domain.com`)
- Passwords/secrets never logged

### Row-Level Security
- `apply_rls.py` script in `/scripts` suggests PostgreSQL RLS is planned or applied on Supabase-connected tables

---

## 9. Deployment Architecture

### Production Stack (Render.com)

```
Render Web Service (prepnest-backend)
  Runtime: Python 3.13
  Start: uvicorn main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips "*"
  Health check: GET /health
  Auto-deploy on push to main

External:
  PostgreSQL → Render Managed Postgres (or Supabase Postgres)
  Redis      → Render Managed Redis
  Files      → Supabase Storage (bucket: uploads)
  Email      → Resend
  AI         → OpenAI API
  Payments   → Safepay
```

### Frontend Deployment (Vercel)

```
Vercel (vercel.json present)
  Build: vite build
  Output: dist/
  Routing: SPA fallback (all routes → index.html)
  CDN: Vercel Edge Network (global CDN)
```

### Local Development (Docker Compose)

```yaml
services:
  db:       postgres:15 (port 5432)
  redis:    (can add)
  backend:  Python/FastAPI (port 8000, hot reload)
  frontend: node:20-alpine, vite dev (port 5173)
```

`docker-compose.dev.yml` adds volume mounts for hot-reload.

### Environment Variables Required in Production

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET_KEY` | HS256 signing key (must be random, long) |
| `OPENAI_API_KEY` | OpenAI API access |
| `FRONTEND_BASE_URL` | For building email verification/reset links |
| `CORS_ORIGINS` | Allowed frontend origins |
| `SUPABASE_URL` | File storage |
| `SUPABASE_SERVICE_KEY` | File storage auth |
| `RESEND_API_KEY` | Transactional email |
| `SAFEPAY_API_KEY` | Payment gateway |
| `SAFEPAY_WEBHOOK_SECRET` | Webhook HMAC verification |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `TRUST_PROXY_HEADERS` | `true` on Render |

---

## 10. Performance Characteristics

### Backend
- **Fully async:** FastAPI + asyncio + SQLAlchemy async + asyncpg — no blocking I/O in the hot path
- **DB pool auto-scales** with CPU count (min 2, max 50 connections)
- **Redis caching** on expensive aggregation queries (dashboard stats, content listings)
- **Streaming SSE** for AI responses — first token appears immediately, no waiting for full generation
- **Concurrent context agents** — RouterAgent output fans out to RetrieverAgent + LiveDataAgent + MemoryAgent in parallel via `asyncio.gather`
- **Cheap routing model** — `gpt-4o-mini` at temperature=0 for classification before the expensive tutor model is invoked

### Frontend
- **Code splitting** — every page is a separate chunk (no monolithic bundle)
- **TanStack Query** — responses cached in memory, no duplicate requests within 60s
- **Exponential backoff retries** — won't hammer a temporarily unavailable API
- **Vercel CDN** — static assets served from edge locations globally

---

## 11. Current Scalability Assessment

### What Scales Well

| Area | Observation |
|---|---|
| Stateless API | No in-process state per request; can run multiple replicas behind a load balancer |
| Async throughout | No thread-per-request bottleneck; handles high concurrency on a single process |
| Redis-backed rate limits | Counters shared across all replicas; no double-counting |
| Streaming AI responses | SSE avoids long-held connections accumulating in a thread pool |
| DB connection pooling | asyncpg pool is process-shared; size auto-adjusts to hardware |
| Frontend CDN | Static assets are globally distributed; no server load for asset delivery |

### What Has Scaling Limits

| Area | Current State | Concern |
|---|---|---|
| FAISS vector store | Local disk, single-process | Not shared across replicas; queries on replica 2 won't see documents indexed by replica 1 |
| File uploads → local disk | `file_storage_mode=local` in dev | Already uses Supabase in prod (fine), but local mode is not replica-safe |
| Celery workers | Installed but underused | Background jobs currently run inside request lifecycle (blocking request for caller) |
| Single database | No read replicas | All reads and writes hit the same Postgres instance |
| SQLite dev fallback | Not production-safe | Fine for dev, but should never reach production |
| Session-level in-memory cache | Falls back to dict when Redis is down | Multiple replicas will have divergent caches in degraded mode |

---

## 12. Known Gaps & Improvement Recommendations

These are observations based on the current codebase. They are ordered by rough impact.

### High Priority

**1. FAISS is not distributed**  
The vector store lives on local disk. In a multi-replica deployment, each replica has its own index. Uploaded documents indexed on replica A are invisible to replica B.  
→ **Fix:** Use a managed vector database (Pinecone, Weaviate, pgvector extension on Postgres) that all replicas share over the network.

**2. No database migrations tool**  
Schema is applied with SQLAlchemy `create_all` on startup. This is create-only — it cannot handle ALTER TABLE, column renames, or data migrations as the schema evolves.  
→ **Fix:** Add Alembic for versioned migrations. One-time setup; pays off on the first schema change.

**3. No refresh tokens**  
JWTs expire after 24 hours and there is no refresh mechanism. Users are silently logged out mid-session.  
→ **Fix:** Implement a short-lived access token (15 min) + long-lived refresh token (7–30 days, stored in an `httpOnly` cookie or secure storage). Refresh endpoint issues new access token without re-login.

**4. Celery is installed but not wired for heavy tasks**  
Document ingestion into FAISS, email sending, and vector store updates currently happen inside the request lifecycle. Under load this increases response latency and can time out.  
→ **Fix:** Move document ingestion, email sending, and index updates to Celery tasks. Add a Celery worker service to `render.yaml` and `docker-compose.yml`.

### Medium Priority

**5. No read-replica support**  
All database traffic hits a single Postgres instance.  
→ **Fix:** Add a read-replica and route `SELECT` queries to it. SQLAlchemy supports this via engine-level routing.

**6. Password reset token stored as a hash but not as a separate table**  
If a user requests multiple resets rapidly, the old token is overwritten and becomes invalid immediately. The new token overwriting the old one is the right behaviour, but there is no audit trail.  
→ **Fix:** This is mostly acceptable. Consider a dedicated `password_reset_requests` table if audit logging is required.

**7. `preferences` column is a free-form JSON blob**  
User preferences are stored as untyped JSON. As the feature grows this becomes hard to validate and query.  
→ **Fix:** Define a typed Pydantic schema for `preferences` and validate on write. Use PostgreSQL JSONB with check constraints if querying by preference key is needed.

**8. Admin panel has no audit log**  
Admin content changes (creating MCQs, deleting topics, editing materials) leave no record.  
→ **Fix:** Add an `audit_log` table: `(id, admin_id, action, resource_type, resource_id, diff_json, created_at)`.

**9. No pagination on some list endpoints**  
Some endpoints return all rows from a table (all MCQs for a topic, all past papers). As content grows this will cause slow queries and large payloads.  
→ **Fix:** Add `limit` + `offset` (or cursor-based) pagination to all list endpoints.

**10. E2E tests exist but CI/CD pipeline not visible**  
Playwright and Vitest test suites exist. No `github-actions` or equivalent workflow file was found in the repo.  
→ **Fix:** Add a GitHub Actions workflow: lint → unit tests → integration tests → build on every PR.

### Lower Priority / Nice-to-Have

**11. Observability is minimal**  
Logging uses Python's `logging` module. No structured JSON logs, no distributed tracing, no metrics endpoint.  
→ **Fix:** Structured logs (JSON format for log aggregators), OpenTelemetry tracing, a `/metrics` endpoint (Prometheus format via `prometheus-fastapi-instrumentator`).

**12. API versioning is `/v1` but not enforced by routing**  
`/api/v1` prefix exists, but there is no version negotiation or deprecation path.  
→ **Fix:** Acceptable for now. When breaking changes are needed, add a `/v2` router and deprecate `/v1` with a sunset date header.

**13. Frontend has no error boundary**  
A JS error in one page component can crash the entire app.  
→ **Fix:** Wrap route-level components in React `ErrorBoundary` components with fallback UI.

**14. Dark mode flicker on first load**  
`next-themes` injects the theme class after hydration. Users on dark mode may see a brief white flash.  
→ **Fix:** Inject a small inline script in `index.html` that reads `localStorage` and sets the class before React mounts.

**15. No WebSocket for real-time features**  
Query Room uses polling or manual refresh. Collaboration features would need WebSockets.  
→ **Fix:** FastAPI natively supports WebSockets. For the Query Room, Server-Sent Events (already used in chat) could provide live answer notifications.

---

*Document generated from source code analysis — May 2026. Review against current codebase before sharing externally.*


---

## 13. Scalability & Reliability Overhaul (2026 Refresh)

This section documents the platform-wide changes made to support a high
concurrent student population without sacrificing local-development
ergonomics. None of the existing features were removed; every change is
either additive or a backward-compatible upgrade.

### 13.1 Database Migrations (Alembic)

* `backend/alembic/` — environment, `script.py.mako`, and a versions
  directory. `env.py` reuses `app.db.session.resolve_database_url` so
  asyncpg URLs and SSL flags work the same as the runtime engine.
* `0001_initial` — idempotent baseline that calls
  `Base.metadata.create_all(checkfirst=True)`. Existing production DBs
  that were bootstrapped via the old startup `create_all` should be
  marked with `alembic stamp 0001_initial` so they never re-run it.
* `0002_perf_indexes` — composite indexes on hot read paths
  (messages, conversations, file_assets, MCQs, query room, practice
  results, payments, mock tests), adds `ai_usage` and
  `document_chunks` tables, and enables the `vector` extension when
  the database supports it. Falls back gracefully on managed Postgres
  variants where `CREATE EXTENSION` requires a superuser.
* In production the deploy pipeline must run
  `alembic upgrade head` before starting the API. `app.main` keeps a
  `create_all` path only for dev / test.

### 13.2 Pagination Conventions

* New helper `app/api/pagination.py` exposes `DEFAULT_LIMIT=20` and
  `MAX_LIMIT=100`, a `Page[T]` envelope (`items`, `total`,
  `limit`, `offset`, `has_more`) and a cursor-pagination utility
  for feed-style endpoints.
* `GET /conversations/page` is the first paginated endpoint;
  the legacy `GET /conversations` still works to avoid breaking
  existing clients.

### 13.3 Background Jobs (Celery)

* Celery 5.5 with Redis as broker and result backend.
* Three queues: `celery` (default), `email`, `ingestion`.
* Worker hardening: `acks_late=True`,
  `task_reject_on_worker_lost=True`,
  `worker_prefetch_multiplier=1`,
  `worker_max_tasks_per_child=200`, soft/hard time limits 300s/360s.
* `ingest_file_task` retries with exponential backoff up to 3 times.
* New `email.send_verification` and `email.send_password_reset`
  tasks. `auth.py` now enqueues via
  `enqueue_verification_email` / `enqueue_password_reset_email`;
  helpers fall back to in-process send if the broker is unreachable so
  sign-up still works during a Redis outage.
* File upload pipeline returns immediately with
  `status="processing"`. The frontend polls
  `GET /files/{id}/status` (`FileStatusResponse`) which reports
  `pending` â†’ `processing` â†’ `ready`/`failed` plus
  `processed_at` and any `error_message`.

### 13.4 Vector Store (pgvector primary, FAISS fallback)

* New `document_chunks` table with an `embedding vector(1536)`
  column and a JSONB `metadata_json` column. An IVFFlat index with
  `vector_cosine_ops` (lists=100) is created when the extension is
  available.
* `app/services/pgvector_store.py` — single source of truth for
  similarity search across replicas. Filters by `user_id` and
  `conversation_id` so privacy is preserved.
* RAG ingestion writes to pgvector when available and to the local
  FAISS index when it is not, so single-machine dev / test still works.
* `Retriever` queries pgvector first, then FAISS as a fallback.

### 13.5 Redis Caching

* `cache_service` already provides `get/set_json`, `delete`,
  `delete_pattern`, `check_rate_limit`, `check_hourly_rate_limit`
  and `check_daily_quota`.
* TTL guidance per namespace:
  * `usat:*` (subjects, topics, listings) — 10–30 min
  * `user:*` (profile, plan) — 1–5 min
  * `site:*` (CMS settings, footer) — 30–60 min
* Admin write endpoints should call
  `cache_service.delete_pattern("usat:*")` (or the relevant
  namespace) on mutation. Invalidations are best-effort and fall back
  to TTL expiration.

### 13.6 AI Endpoint Protection

* `app/services/ai_concurrency.py` — per-user
  (`AI_PER_USER_MAX_CONCURRENT`, default 2) and global
  (`AI_GLOBAL_MAX_CONCURRENT`, default 50) concurrency caps. Leases
  are tracked in a Redis hash with self-expiring members so a crashed
  worker never permanently consumes a slot. On capacity, the limiter
  returns `HTTP 429` with a friendly message and `Retry-After` header.
* `app/services/ai_usage_service.py` + `ai_usage` table records
  `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`,
  `latency_ms`, `user_id`, `conversation_id`, `status`. This
  feeds:
  * Daily token quotas (`daily_token_total(user_id)`) for free vs pro
    plans, on top of the existing per-feature daily counters.
  * Admin monthly analytics via `GET /admin/analytics/ai-usage`.
* `llm_service` now sets a 45s OpenAI timeout (configurable via
  `OPENAI_TIMEOUT_SECONDS`) and falls back to
  `OPENAI_FALLBACK_MODEL` (default `gpt-4o-mini`) on timeout/error.
* Streaming responses include incremental token tracking so analytics
  are still recorded even though the OpenAI streaming API does not
  return `response.usage`.

### 13.7 Frontend Resilience (Phase 6)

* `components/ErrorBoundary.tsx` — class boundary with friendly
  fallback (Try again / Reload page) and best-effort
  `window.Sentry.captureException` reporting. Wrapped around the
  global `<Suspense>` so any lazy chunk failure stays contained.
* `components/skeletons.tsx` — reusable Dashboard, MCQ list, Mock
  Test, Query Room, AI Tutor skeletons plus `EmptyState` and
  `RetryButton` primitives.
* TanStack Query already configured with `staleTime=60s`,
  `gcTime=5min`, `retry=1`, `refetchOnWindowFocus=false`.

### 13.8 Observability (Phase 7)

* `app/core/observability.py` — lazy Sentry init reading
  `SENTRY_DSN`, `APP_ENV`, `APP_RELEASE` /
  `RENDER_GIT_COMMIT`, with default trace sampling of 5 percent.
  Sends no PII.
* Frontend reads `VITE_SENTRY_DSN` (wire-up optional in
  `main.tsx`).
* Existing request-id middleware now flows through structured logs;
  `user_id` is attached after auth resolves.
* `load_tests/locustfile.py` and `load_tests/README.md` provide
  five user classes (browsing, MCQ, AI tutor stream, upload, mock
  test) with realistic weights for staging soak runs.

### 13.9 Environment Variables (new in this refresh)

| Variable                        | Default              | Purpose                                  |
| ------------------------------- | -------------------- | ---------------------------------------- |
| `AI_PER_USER_MAX_CONCURRENT`  | 2                    | Per-user AI concurrency cap              |
| `AI_GLOBAL_MAX_CONCURRENT`    | 50                   | Global AI concurrency cap                |
| `AI_LEASE_SECONDS`            | 120                  | Lease TTL for concurrency slots          |
| `OPENAI_TIMEOUT_SECONDS`      | 45                   | OpenAI client timeout                    |
| `OPENAI_FALLBACK_MODEL`       | `gpt-4o-mini`      | Cheaper model used after a primary fail  |
| `USE_PGVECTOR`                | 1                    | Set to 0 to force FAISS even on Postgres |
| `SENTRY_DSN` (backend)        | (unset)              | Enables backend Sentry integration       |
| `VITE_SENTRY_DSN` (frontend)  | (unset)              | Enables frontend Sentry integration      |
| `LOCUST_TOKEN`                | (unset)              | JWT used by load tests for auth routes   |

---

*Section 13 added during the 2026 scalability overhaul. See git history for the change set.*
