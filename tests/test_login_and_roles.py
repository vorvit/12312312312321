from datetime import timedelta


def test_login_and_me_flow(client, create_user):
    u = create_user("user@test.com", "secret123", admin=False, active=True)

    # CSRF token required for POST
    r_get = client.get("/login")
    csrf = r_get.cookies.get("csrf_token")
    assert csrf

    r = client.post(
        "/auth/login",
        json={"email": "user@test.com", "password": "secret123"},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200
    token = r.json().get("access_token")
    assert token

    r2 = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    data = r2.json()
    assert data["email"] == "user@test.com"
    assert data["is_admin"] is False


def test_admin_access_forbidden_for_user(client, create_user):
    u = create_user("user2@test.com", "secret123", admin=False)
    r_get = client.get("/login")
    csrf = r_get.cookies.get("csrf_token")
    r = client.post(
        "/auth/login",
        json={"email": "user2@test.com", "password": "secret123"},
        headers={"X-CSRF-Token": csrf},
    )
    token = r.json().get("access_token")
    r_admin = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert r_admin.status_code in (401, 403)


def test_admin_access_ok_for_admin(client, create_user):
    admin = create_user("admin@test.com", "secret123", admin=True)
    r_get = client.get("/login")
    csrf = r_get.cookies.get("csrf_token")
    r = client.post(
        "/auth/login",
        json={"email": "admin@test.com", "password": "secret123"},
        headers={"X-CSRF-Token": csrf},
    )
    token = r.json().get("access_token")
    r_admin = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    # admin endpoint requires admin user
    assert r_admin.status_code == 200

