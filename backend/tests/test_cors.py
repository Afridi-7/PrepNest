from fastapi.testclient import TestClient

from app.main import app


def test_cors_preflight_allows_localhost_loopback_origin() -> None:
    client = TestClient(app)
    origin = "http://localhost:8080"

    response = client.options(
        "/api/v1/admin/mcqs/upload-csv",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"
