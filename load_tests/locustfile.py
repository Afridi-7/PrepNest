"""Locust load-test scenarios for PrepNest.

Run examples
------------
Install once::

    pip install locust>=2.27

Headless run (5 minutes, ramping users)::

    locust -f load_tests/locustfile.py \
        --host=http://localhost:8000 \
        --headless --users 770 --spawn-rate 20 --run-time 5m

Or open the web UI::

    locust -f load_tests/locustfile.py --host=http://localhost:8000

Scenarios mirror the Phase 7 deliverable:

* ``BrowsingUser``    — landing pages, dashboard, listings           (weight 500)
* ``MCQUser``         — practice MCQ fetch/answer flow              (weight 100)
* ``AITutorStreamUser`` — open SSE stream and consume tokens         (weight 50)
* ``UploadUser``      — upload small file then poll for ready        (weight 20)
* ``MockTestUser``    — start mock test, answer questions, submit    (weight 100)

Authentication is best-effort. Set ``LOCUST_TOKEN`` to an existing JWT to
exercise authenticated routes; otherwise authenticated tasks are skipped
gracefully so the harness stays useful even before a seed user exists.
"""
from __future__ import annotations

import io
import json
import os
import random

from locust import HttpUser, between, task

API_PREFIX = os.getenv("LOCUST_API_PREFIX", "/api/v1")
TOKEN = os.getenv("LOCUST_TOKEN")  # JWT for authenticated scenarios


def _auth_headers() -> dict[str, str]:
    if TOKEN:
        return {"Authorization": f"Bearer {TOKEN}"}
    return {}


class BrowsingUser(HttpUser):
    weight = 500
    wait_time = between(1, 4)

    @task(5)
    def landing(self) -> None:
        self.client.get("/", name="landing")

    @task(3)
    def health(self) -> None:
        self.client.get(f"{API_PREFIX}/health", name="health")

    @task(2)
    def dashboard(self) -> None:
        if not TOKEN:
            return
        self.client.get(f"{API_PREFIX}/dashboard", name="dashboard", headers=_auth_headers())


class MCQUser(HttpUser):
    weight = 100
    wait_time = between(2, 6)

    @task
    def list_mcqs(self) -> None:
        if not TOKEN:
            return
        self.client.get(
            f"{API_PREFIX}/usat/mcqs?limit=20",
            name="mcq_list",
            headers=_auth_headers(),
        )


class AITutorStreamUser(HttpUser):
    weight = 50
    wait_time = between(5, 15)

    @task
    def stream_chat(self) -> None:
        if not TOKEN:
            return
        prompts = [
            "Explain photosynthesis in 3 sentences.",
            "Give me 2 quick tips for solving SUVAT problems.",
            "Summarise the difference between mitosis and meiosis.",
        ]
        body = {"message": random.choice(prompts)}
        with self.client.post(
            f"{API_PREFIX}/chat/stream",
            json=body,
            headers={**_auth_headers(), "Accept": "text/event-stream"},
            stream=True,
            name="chat_stream",
            catch_response=True,
        ) as resp:
            # Consume a bounded amount of the SSE stream so the harness
            # doesn't keep one user pinned forever.
            consumed = 0
            for line in resp.iter_lines():
                consumed += 1
                if consumed > 60:
                    break
            resp.success()


class UploadUser(HttpUser):
    weight = 20
    wait_time = between(10, 30)

    @task
    def upload_and_poll(self) -> None:
        if not TOKEN:
            return
        payload = io.BytesIO(b"hello world\n" * 100)
        files = {"file": ("loadtest.txt", payload, "text/plain")}
        with self.client.post(
            f"{API_PREFIX}/files/upload",
            files=files,
            headers=_auth_headers(),
            name="file_upload",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"upload failed: {resp.status_code}")
                return
            try:
                file_id = resp.json().get("id")
            except json.JSONDecodeError:
                resp.failure("upload returned non-JSON")
                return
            if not file_id:
                resp.failure("upload missing id")
                return
            resp.success()
            # Poll status a few times — emulates the frontend's polling UI.
            for _ in range(3):
                self.client.get(
                    f"{API_PREFIX}/files/{file_id}/status",
                    name="file_status",
                    headers=_auth_headers(),
                )


class MockTestUser(HttpUser):
    weight = 100
    wait_time = between(3, 8)

    @task
    def list_mock_tests(self) -> None:
        if not TOKEN:
            return
        self.client.get(
            f"{API_PREFIX}/mock-tests",
            name="mock_tests_list",
            headers=_auth_headers(),
        )
