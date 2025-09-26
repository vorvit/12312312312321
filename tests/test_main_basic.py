import re
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_login_page_ok():
    r = client.get("/login")
    assert r.status_code == 200
    # csrf cookie should be set by middleware/page
    cookies = r.cookies
    assert any(k.lower() == "csrf_token" for k in cookies.keys())


def test_ifc_viewer_redirect_default():
    r = client.get("/ifc-viewer", follow_redirects=False)
    assert r.status_code in (302, 307)
    loc = r.headers.get("location", "")
    assert loc.startswith("http://localhost:5174")


def test_users_me_unauthorized():
    r = client.get("/users/me")
    # Depending on middleware/auth stack it can be 401 or 403
    assert r.status_code in (401, 403)


def test_files_list_unauthorized():
    r = client.get("/api/files")
    assert r.status_code == 401


def test_web_ifc_static_served():
    # Verify wasm served and content-type is application/wasm
    r = client.get("/web-ifc/web-ifc.wasm")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/wasm")


