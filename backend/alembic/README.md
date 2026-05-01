# Alembic migrations

Source-of-truth for the production database schema. The legacy
`Base.metadata.create_all` call in `app/main.py` remains as a **dev-only
fallback** so local SQLite still works without running Alembic.

## Common commands

Run from the `backend/` directory with the virtualenv activated and
`DATABASE_URL` (or the equivalent `PG_*` env vars) set.

```bash
# Apply all pending migrations
alembic upgrade head

# Create a new auto-generated migration after editing models
alembic revision --autogenerate -m "describe change"

# Roll back one migration
alembic downgrade -1

# Show current revision
alembic current
```

## First-time setup against an existing database

If your database already has tables created by `create_all`, stamp it with
the initial revision before running `upgrade`:

```bash
alembic stamp 0001_initial
```

## Production deploys

Run `alembic upgrade head` as a release/predeploy step (e.g. Render's
`preDeployCommand`, a Kubernetes Job, or a CI step) **before** the new
backend version starts. Never run `create_all` in production.
