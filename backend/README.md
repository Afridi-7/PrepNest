# PrepNest AI Tutor Backend

Production-grade FastAPI backend for an agentic RAG AI tutor with streaming chat, document ingestion, retrieval, live data, visualization generation, memory, and persistent history.

## 1) Folder Structure

```text
backend/
  app/
    api/
      deps.py
      routers/
        auth.py
        users.py
        chat.py
        files.py
        conversations.py
    agents/
      base.py
      router_agent.py
      memory_agent.py
      retriever_agent.py
      live_data_agent.py
      visualization_agent.py
      tutor_agent.py
      orchestrator.py
    core/
      config.py
      logging.py
      security.py
    db/
      base.py
      models.py
      session.py
      repositories/
        user_repo.py
        conversation_repo.py
        message_repo.py
        file_repo.py
    rag/
      chunking.py
      vector_store.py
      retriever.py
      ingestion.py
    services/
      cache_service.py
      llm_service.py
      storage_service.py
      chat_service.py
      file_service.py
      history_service.py
    tools/
      pdf_tool.py
      ocr_tool.py
      web_search.py
      diagram_tool.py
      image_tool.py
    workers/
      celery_app.py
      tasks.py
    schemas/
      user.py
      chat.py
      file.py
      conversation.py
    main.py
  requirements.txt
  .env.example
  docker-compose.yml
  Dockerfile
```

## 2) Tech Stack and Why

- FastAPI + async SQLAlchemy: high-performance async API with clean service/repository boundaries.
- PostgreSQL: reliable ACID persistence for users, conversations, messages, and file metadata.
- Redis: low-latency cache and rate-limiting state for live-data requests.
- FAISS: fast vector similarity retrieval for RAG over uploaded and indexed files.
- OpenAI API: high-quality generation/embeddings (with deterministic fallback if API key is not set).
- Celery + Redis broker: background processing for heavy ingestion jobs.
- Local/S3-ready storage abstraction: straightforward local runs and cloud migration path.

## 3) Core Capabilities Implemented

- Agentic orchestration:
  - Router Agent: decides retrieval/live/visualization tool path.
  - Memory Agent: summarizes recent context and preferences.
  - Retriever Agent: semantic retrieval from FAISS vector store.
  - Live Data Agent: up-to-date info fetch from external source with cache + rate limit.
  - Visualization Agent: Mermaid + chart/image artifact generation.
  - Tutor Agent: structured step-by-step educational response generation.
- Streaming chat over SSE (`/api/v1/chat/stream`).
- Multi-turn conversation persistence and retrieval.
- File upload (PDF/images/text) + extraction + chunking + indexing into FAISS.
- Basic user management and JWT authentication.

## 4) API Endpoints

- Auth:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
- Users:
  - `GET /api/v1/users/me`
  - `PATCH /api/v1/users/me/preferences`
- Chat:
  - `POST /api/v1/chat` (non-stream)
  - `POST /api/v1/chat/stream` (SSE stream)
- Files:
  - `POST /api/v1/files/upload?conversation_id=<id>`
- Conversations:
  - `GET /api/v1/conversations`
  - `GET /api/v1/conversations/{conversation_id}`
- Health:
  - `GET /health`

## 5) Local Setup

### A) Start dependencies

```bash
docker compose up -d
```

### B) Environment

```bash
cp .env.example .env
```

Set `OPENAI_API_KEY` to enable full model and embedding quality.

### C) Install and run

```bash
python -m venv .venv
. .venv/Scripts/activate   # Windows PowerShell
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### D) Optional worker for async ingestion

```bash
celery -A app.workers.celery_app.celery_app worker --loglevel=info
```

Set `ENABLE_CELERY_INGESTION=true` in `.env` to queue file indexing jobs through Celery.

## 6) Example Flow

1. Register and login to get JWT.
2. Create chat by calling `POST /api/v1/chat` with no `conversation_id`.
3. Upload files to that conversation using `POST /api/v1/files/upload`.
4. Continue chat (streaming or non-streaming). Retriever Agent uses indexed chunks.
5. Fetch prior history via `GET /api/v1/conversations` and detail endpoint.

## 7) Scalability and Reliability Notes

- Horizontal API scaling is supported (stateless app nodes + shared Postgres/Redis).
- Cache + rate limiting reduce repeated live-data load.
- Worker process separates heavy ingestion from request latency path.
- Modular agents/tools allow per-component fallback and controlled failure isolation.
- Input validation is enforced via Pydantic schemas and size limits for uploads.

## 8) Production Recommendations

- Replace permissive CORS and add origin allowlist.
- Add request-level authz checks for all resources.
- Add tracing/metrics (OpenTelemetry + Prometheus).
- Add DB migrations with Alembic.
- Store uploads in S3 and serve visuals via signed URLs.
- Add policy guardrails for prompt injection and unsafe outputs.
