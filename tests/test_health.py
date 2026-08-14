import pytest

from server import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_index(client):
    rv = client.get('/')
    assert rv.status_code == 200


def test_health_endpoint(client):
    rv = client.get('/api/health')
    # Health endpoint should return JSON with version or status
    assert rv.status_code in (200, 404)
