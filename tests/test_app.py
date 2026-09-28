from fastapi.testclient import TestClient

from src.main import app


def test_home_page_loads():
    with TestClient(app) as client:
        response = client.get("/")
    assert response.status_code == 200
    assert "AssureX" in response.text
