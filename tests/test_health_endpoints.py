def test_health_endpoint_ok_with_mocks(client, monkeypatch):
    # Monkeypatch HealthCheckService.check_all to avoid real dependencies
    import main as app_main

    async def fake_check_all():
        return {
            "overall_status": "healthy",
            "services": {
                "database": {"status": "healthy"},
                "redis": {"status": "healthy"},
                "minio": {"status": "healthy"},
                "postgres": {"status": "unhealthy"},
            },
        }

    monkeypatch.setattr(app_main.HealthCheckService, "check_all", staticmethod(fake_check_all))

    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("overall_status") in ("healthy", "degraded")


def test_health_sub_endpoints(client, monkeypatch):
    import main as app_main

    async def ok():
        return {"status": "healthy"}

    monkeypatch.setattr(app_main.HealthCheckService, "check_database", staticmethod(ok))
    monkeypatch.setattr(app_main.HealthCheckService, "check_redis", staticmethod(ok))
    monkeypatch.setattr(app_main.HealthCheckService, "check_minio", staticmethod(ok))
    monkeypatch.setattr(app_main.HealthCheckService, "check_postgres", staticmethod(ok))

    assert client.get("/health/database").status_code == 200
    assert client.get("/health/redis").status_code == 200
    assert client.get("/health/minio").status_code == 200
    assert client.get("/health/postgres").status_code == 200

