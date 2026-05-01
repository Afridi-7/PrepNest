from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "prepnest_ai_tutor",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Reliability — re-queue on worker crash, cap memory leaks via recycling,
    # and keep prefetch low so a long PDF doesn't block fast email tasks.
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=200,
    # Per-task soft + hard timeouts protect against runaway model calls
    # or stuck PDF parsers.
    task_soft_time_limit=300,
    task_time_limit=360,
    # Route by family so a slow ingestion job can't starve verification
    # email delivery.
    task_routes={
        "email.*": {"queue": "email"},
        "tasks.ingest_file": {"queue": "ingestion"},
    },
    # Eagerly load task modules so workers see them on boot.
    imports=(
        "app.features.ai_tutor.workers.tasks",
        "app.features.ai_tutor.workers.email_tasks",
    ),
)
