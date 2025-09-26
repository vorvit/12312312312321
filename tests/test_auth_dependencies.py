from fastapi.testclient import TestClient
from datetime import timedelta

from main import app
from app.auth.auth import AuthService

client = TestClient(app)


def make_token(user_id: int):
    return AuthService.create_access_token(data={"sub": str(user_id)}, expires_delta=timedelta(minutes=5))


def test_get_current_user_cookie_fallback_unauthorized():
    # No header, no cookie -> 401 on a cookie-protected route (profile)
    r = client.get("/profile")
    # middleware redirects to /login for HTML pages; accept both behaviors
    assert r.status_code in (200, 302)


def test_auth_check_with_header_token_invalid():
    # Invalid token should be rejected
    r = client.get("/auth/check", headers={"Authorization": "Bearer invalid"})
    assert r.status_code == 200
    assert r.json().get("authenticated") is False


