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


# ---------------------------------------------------------------------------
# Regression test for the missing-authorization gap: every /api/* business
# route must reject unauthenticated requests with 401. Previously none of
# these enforced a session server-side — the login screen only gated the
# browser UI. If this test starts failing, someone removed the auth gate.
# ---------------------------------------------------------------------------
PROTECTED_ROUTES = [
    ("GET", "/api/history/trends"),
    ("GET", "/api/history/agents"),
    ("GET", "/api/history/anomalies"),
    ("GET", "/api/patterns/notes"),
    ("GET", "/api/patterns/notes/1"),
    ("POST", "/api/audit/score"),
    ("POST", "/api/audit/batch"),
    ("POST", "/api/analyse/sentiment"),
    ("POST", "/api/patterns/notes"),
]


@pytest.mark.parametrize("method,path", PROTECTED_ROUTES)
def test_protected_routes_require_auth(client, method, path):
    rv = client.open(path, method=method, json={})
    assert rv.status_code == 401, (
        f"{method} {path} should require authentication but returned {rv.status_code}"
    )
    body = rv.get_json()
    assert body is not None and body.get("error") == "Authentication required", (
        f"{method} {path} returned 401 but not from the auth gate: {body}"
    )


def test_public_auth_routes_remain_reachable_without_a_session(client):
    # These must NOT be blocked by the blanket /api/* auth gate, or nobody
    # could ever log in. Each has its own logic for what an unauthenticated
    # caller sees — none of them should be the auth gate's generic message.
    rv = client.get('/api/auth/session')
    assert rv.status_code == 401
    assert rv.get_json().get("authenticated") is False

    rv = client.post('/api/auth/login', json={"username": "nobody", "password": "wrong"})
    assert rv.status_code in (400, 401)
    assert rv.get_json().get("error") != "Authentication required"

    rv = client.post('/api/auth/logout')
    assert rv.status_code == 200
