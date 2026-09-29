from fastapi.testclient import TestClient

from src.main import app
from src.platform.pages import PAGES


def test_every_page_loads():
    with TestClient(app) as client:
        for path in PAGES:
            response = client.get(path)
            assert response.status_code == 200, path
            assert "assurex" in response.text.lower(), path
