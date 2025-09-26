from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_csrf_blocks_post_without_token():
    # POST to a CSRF-protected endpoint without token should fail (403)
    r = client.post("/auth/login", json={"email": "x@y.z", "password": "p"})
    assert r.status_code in (400, 403)  # 400 if validation triggers first; else 403 by CSRF


def test_auth_check_anonymous_false():
    r = client.get("/auth/check")
    assert r.status_code == 200
    data = r.json()
    assert data.get("authenticated") is False


def test_ifc_viewer_with_file_param_redirects():
    r = client.get("/ifc-viewer?file=Sample.ifc", follow_redirects=False)
    assert r.status_code in (302, 307)
    loc = r.headers.get("location", "")
    assert "file=Sample.ifc" in loc


