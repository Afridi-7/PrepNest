from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "PrepNest AI Tutor Backend"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_debug: bool = True
    api_prefix: str = "/api/v1"

    database_url: str = "sqlite+aiosqlite:///./prepnest_ai_tutor.db"
    pg_host: str = "localhost"
    pg_port: int = 5432
    pg_database: str = "myapp"
    pg_user: str = "admin"
    pg_password: str = "secret"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60 * 24
    password_reset_token_exp_minutes: int = 30

    # SMTP / Email verification
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_tls: bool = True

    # Resend (email API)
    resend_api_key: str = ""
    resend_from_email: str = ""

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    frontend_url: str = Field(
        default="http://localhost:8080",
        validation_alias=AliasChoices("FRONTEND_URL", "FRONTEND_BASE_URL"),
    )
    cors_origins: str | None = Field(
        default=None,
        validation_alias=AliasChoices("CORS_ORIGINS", "BACKEND_CORS_ORIGINS"),
    )
    cors_origin_regex: str | None = Field(
        default=None,
        validation_alias=AliasChoices("CORS_ORIGIN_REGEX", "BACKEND_CORS_ORIGIN_REGEX"),
    )
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    web_search_api_url: str | None = None
    web_search_api_key: str | None = None

    vector_store_path: str = "./data/vector_store"
    vector_dim: int = 384
    retrieval_top_k: int = 5

    file_storage_mode: str = "local"
    local_upload_dir: str = "./data/uploads"
    max_upload_size_mb: int = 100

    # Supabase Storage
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_storage_bucket: str = "uploads"

    s3_endpoint: str | None = None
    s3_bucket: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_region: str | None = None

    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    enable_celery_ingestion: bool = False

    live_data_ttl_seconds: int = 600
    live_data_rate_limit_per_minute: int = 30

    default_learning_level: str = "intermediate"

    @property
    def upload_dir_path(self) -> Path:
        path = Path(self.local_upload_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def vector_store_dir_path(self) -> Path:
        path = Path(self.vector_store_path)
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
