# API Reference

Base URL: `http://localhost:8000` (development) — production URLs are environment-specific.

Interactive OpenAPI docs are auto-generated and available at:
- Swagger UI: `/docs`
- ReDoc: `/redoc`

This page summarizes the most common endpoints. The OpenAPI schema is the source of truth.

## Authentication

All `/api` endpoints (except auth + public landing data) require a Bearer token:

```
Authorization: Bearer <jwt>
```

### `POST /auth/signup`
Create a new account.

**Body**
```json
{ "email": "user@example.com", "password": "•••••••", "full_name": "Jane Doe" }
```
**Response 201**
```json
{ "id": 1, "email": "user@example.com", "full_name": "Jane Doe" }
```

### `POST /auth/login`
Exchange credentials for a JWT.

**Body**
```json
{ "email": "user@example.com", "password": "•••••••" }
```
**Response 200**
```json
{ "access_token": "eyJhbGciOi…", "token_type": "bearer" }
```

### `POST /auth/forgot-password`
Send a password reset email.

### `POST /auth/reset-password`
Submit token + new password.

### `POST /auth/verify-email`
Confirm a signup verification token.

## Users

### `GET /users/me`
Return the authenticated user.

### `PATCH /users/me`
Update profile fields (`full_name`, avatar, preferences).

## USAT content

### `GET /usat/categories`
List USAT exam categories.

### `GET /usat/categories/{category}/subjects`
Subjects under a category.

### `GET /usat/subjects/{subject_id}/chapters`
Chapters within a subject.

### `POST /usat/subjects` *(admin)*
Create a subject.

### `DELETE /usat/subjects/{id}` *(admin)*
Delete a subject and its descendants.

## Practice / Mock tests

### `POST /mock-tests/start`
Begin a session. Returns the session id and the first batch of questions.

### `POST /mock-tests/{session_id}/answer`
Submit an answer for a question.

### `POST /mock-tests/{session_id}/finish`
Finalize and score the session.

### `GET /mock-tests/history`
Past attempts for the current user.

## AI Tutor / Chat

### `POST /ai/chat`
Stream a tutor response. Streaming uses Server-Sent Events.

**Body**
```json
{ "conversation_id": 12, "message": "Explain photosynthesis" }
```

### `GET /conversations`
List the user's conversations.

### `GET /conversations/{id}/messages`
Messages within a conversation.

## Files

### `POST /files/upload`
Multipart upload. Returns the file metadata and access URL.

### `GET /files/{id}`
Stream or redirect to the file URL.

## Dashboard

### `GET /dashboard/summary`
Aggregated stats (XP, level, attempts, streak) for the current user.

## Admin

### `GET /admin/content/overview` *(admin)*
Counts of subjects/chapters/MCQs per category.

## Errors

All errors are JSON with the shape:

```json
{ "detail": "Human-readable message" }
```

Common status codes: `400` invalid input, `401` missing/invalid token, `403` forbidden (e.g. non-admin), `404` not found, `409` conflict, `429` rate limited, `500` server error.

## Rate limiting

Auth endpoints and AI streaming are rate-limited per IP. Limits return `429 Too Many Requests` with a `Retry-After` header.
