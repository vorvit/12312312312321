import os
import types
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from fastapi.testclient import TestClient

from app.database.base import Base
from app.models.user import User
from app.auth.auth import AuthService
from main import app
import main as main_app


@pytest.fixture(scope="session", autouse=True)
def _patch_email_service():
    # Disable real email sending by monkeypatching email_service
    try:
        from app.email import email_service as es
    except Exception:
        return
    send_called = {"count": 0}

    async def _noop(*args, **kwargs):
        send_called["count"] += 1
        return True

    es.send_password_reset = _noop
    es.send_welcome_email = _noop
    es.send_email_verification = _noop


@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture()
def db_session(test_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session, monkeypatch):
    # Override get_db dependency to use in-memory session
    def _get_db_override():
        try:
            yield db_session
        finally:
            pass

    # Override FastAPI dependency and also the direct reference used inside main.py
    app.dependency_overrides[main_app.get_db] = _get_db_override
    monkeypatch.setattr(main_app, "get_db", _get_db_override, raising=True)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def create_user(db_session):
    def _create_user(email: str, password: str, *, admin: bool = False, active: bool = True):
        user = User(email=email, username=email.split("@")[0], is_active=active, is_admin=admin)
        user.hashed_password = AuthService.get_password_hash(password)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user
    return _create_user


