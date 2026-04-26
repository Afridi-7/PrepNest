# Testing

PrepNest ships with a multi-layer test suite for both backend and frontend.

## Backend (pytest)

```bash
cd backend
. .venv/Scripts/activate
pytest                       # full suite
pytest tests/test_health.py  # single file
pytest -k "auth"             # by keyword
pytest -q --maxfail=1        # quiet, stop on first failure
```

Coverage:

```bash
pytest --cov=app --cov-report=term-missing
```

**Layout** — tests live in `backend/tests/`. Fixtures live in `conftest.py` files. Tests use an isolated SQLite or test Postgres database; never run against production.

**What to test**
- Routers: HTTP contract (status codes, response shape).
- Services: business logic edge cases.
- Repositories: query correctness.
- Security: auth required, input validation, rate limits.

## Frontend (Vitest + Testing Library)

```bash
cd frontend
npm test -- --run            # full suite, single pass
npm run test:watch           # watch mode
npm run test:ui              # browser-based runner
```

Test files live next to the code they cover, under `__tests__` folders, e.g. `src/components/__tests__/Navbar.test.tsx`.

Conventions:
- Use `@testing-library/react` and query by role/label.
- Mock the API client (`apiClient`) — never hit real endpoints.
- Wrap components that use routing in `MemoryRouter`.

## End-to-end (Playwright)

```bash
cd frontend
npm run test:e2e             # headless
npm run test:e2e:ui          # interactive
npm run test:e2e:headed      # show browsers
```

E2E tests assume the backend is running locally and seeded.

## Continuous Integration

CI runs three jobs in parallel:

1. **backend-tests** — `pytest -q` against a fresh Postgres container.
2. **frontend-unit** — `npm test -- --run`.
3. **lint** — `npm run lint` + `ruff check backend/`.

PRs cannot merge until all three pass.

## Local pre-commit checklist

- [ ] `pytest` (backend) — green
- [ ] `npm test -- --run` (frontend) — green
- [ ] `npm run build` (frontend) — green
- [ ] `npm run lint` — clean
