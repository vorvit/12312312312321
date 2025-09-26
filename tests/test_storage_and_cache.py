import io
import types


def test_storage_upload_and_list_with_minio_mock(client, db_session, monkeypatch, create_user):
    # Mock StorageService to avoid real MinIO
    import main as app_main

    files_store = {}

    class MockStorage:
        def get_user_usage(self, user_id: int) -> int:
            return sum(len(v) for k, v in files_store.get(user_id, {}).items())

        def upload_user_file(self, user_id: int, filename: str, file_stream: io.BytesIO, content_type: str) -> bool:
            files_store.setdefault(user_id, {})[filename] = file_stream.getvalue()
            return True

        def download_user_file(self, user_id: int, filename: str) -> bytes | None:
            return files_store.get(user_id, {}).get(filename)

        def delete_user_file(self, user_id: int, filename: str) -> bool:
            if filename in files_store.get(user_id, {}):
                del files_store[user_id][filename]
                return True
            return False

    monkeypatch.setattr(app_main, "StorageService", MockStorage)

    u = create_user("stor@test.com", "secret123", admin=False)
    # login
    r_get = client.get("/login")
    csrf = r_get.cookies.get("csrf_token")
    r = client.post("/auth/login", json={"email": "stor@test.com", "password": "secret123"}, headers={"X-CSRF-Token": csrf})
    token = r.json().get("access_token")

    # upload
    data = io.BytesIO(b"IFCDATA")
    files = {"file": ("Sample.ifc", data, "application/octet-stream")}
    r_up = client.post("/files/upload", headers={"Authorization": f"Bearer {token}"}, files=files)
    assert r_up.status_code == 200

    # list
    r_list = client.get("/api/files", headers={"Authorization": f"Bearer {token}"})
    assert r_list.status_code == 200
    assert any(f.get("name") == "Sample.ifc" for f in r_list.json().get("data", []))


def test_cache_health_with_redis_mock(client, monkeypatch):
    # Mock redis client methods in cache layer if invoked by health check service
    from app.services import health_check as hc

    async def fake_check_all():
        return {
            "services": {
                "database": True,
                "redis": True,
                "minio": True,
                "postgres": False,
            },
            "overall_status": "ok",
        }

    monkeypatch.setattr(hc.HealthCheckService, "check_all", staticmethod(fake_check_all))

    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("overall_status") == "ok"

