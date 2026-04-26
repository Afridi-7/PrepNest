# Setup & Environment

This guide walks you through running PrepNest locally for development.

## Prerequisites

- **Python** 3.11+
- **Node.js** 18+ (LTS recommended) and npm
- **PostgreSQL** 14+ (or a Supabase project URL)
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
. .venv/Scripts/activate     # Windows
# source .venv/bin/activate  # macOS / Linux
pip install -r requirements.txt
```

### Environment variables

Create `backend/.env` (or export in your shell). The most important keys:

| Key | Description | Example |
|---|---|---|
| `DATABASE_URL` | Async Postgres URL | `postgresql+asyncpg://user:pass@localhost:5432/prepnest` |
| `JWT_SECRET_KEY` | Secret for signing JWTs | (32+ random chars) |
| `JWT_ALGORITHM` | Default `HS256` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT lifetime | `60` |
| `CORS_ALLOW_ORIGINS` | Comma-separated frontend URLs | `http://localhost:5173` |
| `OPENAI_API_KEY` | LLM provider key | `sk-...` |
| `SUPABASE_URL` / `SUPABASE_KEY` | (Optional) storage backend | — |

### Run the backend

```bash
python -m uvicorn main:app --reload
```

API will be live at <http://localhost:8000>; interactive docs at <http://localhost:8000/docs>.

## 3. Frontend setup

```bash
cd ../frontend
npm install
npm run dev
```

Frontend boots at <http://localhost:5173> and proxies API calls to the backend.

### Frontend env

Create `frontend/.env.local`:

```
VITE_API_BASE_URL=http://localhost:8000
```

## 4. Docker (optional, full stack)

```bash
docker compose -f docker-compose.dev.yml up --build
```

This brings up Postgres, the backend, and the frontend together.

## Common issues

- **`ModuleNotFoundError`** — re-activate the venv before running uvicorn.
- **CORS error in browser** — ensure `CORS_ALLOW_ORIGINS` includes your frontend URL.
- **`role does not exist`** — create a Postgres user matching `DATABASE_URL` or use Docker compose.
