# Celery worker

The PrepNest backend offloads non-blocking work (email delivery, PDF
parsing, embeddings, vector indexing) to a Celery worker that consumes
from Redis.

## Quick start (local)

```powershell
# 1. Make sure Redis is running locally (docker-compose.dev.yml ships one).
# 2. From the repository root, with the venv active:
cd backend
celery -A app.features.ai_tutor.workers.celery_app:celery_app worker `
  --loglevel=info `
  --concurrency=4 `
  -Q celery,email,ingestion
```

## Production

Run one worker per replica/container. Recommended args:

```bash
celery -A app.features.ai_tutor.workers.celery_app:celery_app worker \
  --loglevel=info \
  --concurrency=${CELERY_CONCURRENCY:-4} \
  --without-gossip --without-mingle --without-heartbeat \
  -Q celery,email,ingestion
```

`acks_late=True` on every task means a crashed worker re-queues the job
so nothing is silently lost. Email and ingestion tasks both retry with
exponential backoff up to 5 attempts.

## Routing

The default `celery` queue holds general tasks. Route email and ingestion
to dedicated queues so a slow PDF doesn't starve verification mail:

```python
celery_app.conf.task_routes = {
    "email.*":   {"queue": "email"},
    "tasks.ingest_file": {"queue": "ingestion"},
}
```

(The configuration is wired in `celery_app.py`; this README documents the
operator side.)
