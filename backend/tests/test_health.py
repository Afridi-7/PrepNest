from fastapi.testclient import TestClient

from app.main import app


def test_healthcheck() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_database_healthcheck() -> None:
    client = TestClient(app)
    response = client.get("/health/db")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "database" in body
