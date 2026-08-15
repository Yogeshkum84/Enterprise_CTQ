"""
Regression tests for the three Phase 1 hardening fixes:
  1. SECRET_KEY persists across restarts instead of regenerating randomly.
  2. ALLOW_DEV_DEFAULTS is tracked so a startup guard can refuse to bind
     to a non-loopback host while the default admin credential is active.
  3. /api/auth/login is rate-limited against brute-force guessing.
"""
import importlib

import pytest

import server as server_module
from server import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


# ---------------------------------------------------------------------------
# 1. SECRET_KEY persistence
# ---------------------------------------------------------------------------
def test_secret_key_is_persisted_to_disk(tmp_path, monkeypatch):
    """A fresh _get_or_create_secret_key() call must write a .secret_key
    file and a second call must reuse it, not generate a new one."""
    monkeypatch.setattr(server_module, "BASE_DIR", tmp_path)
    monkeypatch.delenv("SECRET_KEY", raising=False)

    key_path = tmp_path / ".secret_key"
    assert not key_path.exists()

    first = server_module._get_or_create_secret_key()
    assert key_path.exists()
    assert key_path.read_text(encoding="utf-8").strip() == first

    second = server_module._get_or_create_secret_key()
    assert second == first, "SECRET_KEY changed between calls — sessions would be invalidated on every restart"


def test_secret_key_env_var_takes_precedence(tmp_path, monkeypatch):
    monkeypatch.setattr(server_module, "BASE_DIR", tmp_path)
    monkeypatch.setenv("SECRET_KEY", "explicit-value-from-env")
    assert server_module._get_or_create_secret_key() == "explicit-value-from-env"
    assert not (tmp_path / ".secret_key").exists(), "should not touch disk when SECRET_KEY is set explicitly"


# ---------------------------------------------------------------------------
# 2. ALLOW_DEV_DEFAULTS tracking (the startup guard itself lives in the
#    `if __name__ == "__main__":` block and binds a real socket, so it isn't
#    exercised here — this locks down the flag the guard depends on).
# ---------------------------------------------------------------------------
def test_dev_defaults_flag_off_without_explicit_opt_in(monkeypatch):
    monkeypatch.delenv("ALLOW_DEV_DEFAULTS", raising=False)
    monkeypatch.delenv("FLASK_ENV", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD_HASH", raising=False)
    monkeypatch.delenv("USER_PASSWORD_HASH", raising=False)

    server_module._DEV_DEFAULTS_ACTIVE = False
    server_module._load_users_from_env()
    assert server_module._DEV_DEFAULTS_ACTIVE is False


def test_dev_defaults_flag_on_when_explicitly_enabled(monkeypatch):
    monkeypatch.setenv("ALLOW_DEV_DEFAULTS", "true")
    monkeypatch.setenv("FLASK_ENV", "development")
    monkeypatch.delenv("ADMIN_PASSWORD_HASH", raising=False)
    monkeypatch.delenv("USER_PASSWORD_HASH", raising=False)

    server_module._DEV_DEFAULTS_ACTIVE = False
    users = server_module._load_users_from_env()
    assert server_module._DEV_DEFAULTS_ACTIVE is True
    assert "admin" in users


# ---------------------------------------------------------------------------
# 3. Rate limiting on /api/auth/login
# ---------------------------------------------------------------------------
def test_login_is_rate_limited_after_repeated_failures(client):
    if server_module.limiter is None:
        pytest.skip("flask-limiter not installed")

    payload = {"username": "nobody", "password": "wrong"}
    responses = [client.post('/api/auth/login', json=payload).status_code for _ in range(6)]

    assert 429 in responses, f"expected a 429 within 6 rapid attempts, got {responses}"
    idx = responses.index(429)
    rv = client.post('/api/auth/login', json=payload)
    assert rv.status_code == 429
    assert rv.get_json().get("error")
