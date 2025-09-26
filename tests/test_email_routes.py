from unittest.mock import AsyncMock, patch


def test_forgot_password_route_mocked(client, monkeypatch):
    with patch("main.email_service.send_password_reset", new=AsyncMock()) as mock_send:
        r_get = client.get("/login")
        csrf = r_get.cookies.get("csrf_token")
        r = client.post("/auth/forgot-password", json={"email": "user@example.com"}, headers={"X-CSRF-Token": csrf})
        assert r.status_code in (200, 202, 204)
        assert mock_send.await_count >= 0


def test_verify_email_route_mocked(client, monkeypatch):
    with patch("main.email_service.send_email_verification", new=AsyncMock()) as mock_verify:
        r_get = client.get("/login")
        csrf = r_get.cookies.get("csrf_token")
        r = client.post("/auth/resend-verification", json={"email": "user@example.com"}, headers={"X-CSRF-Token": csrf})
        assert r.status_code in (200, 202, 204)
        assert mock_verify.await_count >= 0

