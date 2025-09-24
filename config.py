import os
from typing import Optional

# Load environment variables
try:
    from dotenv import load_dotenv
    # Load base .env if present
    load_dotenv()
    # Load per-environment file: .env.development / .env.production (overrides)
    _env = os.getenv("ENV") or os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or os.getenv("FASTAPI_ENV")
    if _env:
        load_dotenv(dotenv_path=f".env.{_env}", override=True)
except ImportError:
    _env = os.getenv("ENV")

class Settings:
    # Environment
    ENV: str = (os.getenv("ENV") or os.getenv("APP_ENV") or "development").lower()
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./auth.db")
    
    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    
    # MinIO
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
    MINIO_BUCKET_NAME: str = os.getenv("MINIO_BUCKET_NAME", "user-files")
    
    # Email
    MAIL_USERNAME: str = os.getenv("MAIL_USERNAME", "your-email@gmail.com")
    MAIL_PASSWORD: str = os.getenv("MAIL_PASSWORD", "your-app-password")
    MAIL_FROM: str = os.getenv("MAIL_FROM", "noreply@ifc-auth.com")
    MAIL_FROM_NAME: str = os.getenv("MAIL_FROM_NAME", "IFC Auth Service")
    MAIL_SERVER: str = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT: int = int(os.getenv("MAIL_PORT", "587"))
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    
    # Redis Cache
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    
    # PostgreSQL (alternative to SQLite)
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "auth_db")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "auth_user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "auth_password")

    # App
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"

    # Cookies / CSRF
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "").lower() == "true" if os.getenv("COOKIE_SECURE") else (not DEBUG)
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "strict" if not DEBUG else "lax")
    CSRF_ENABLED: bool = os.getenv("CSRF_ENABLED", "True").lower() == "true"

    # Rate limit (login)
    RATE_LIMIT_LOGIN_ATTEMPTS: int = int(os.getenv("RATE_LIMIT_LOGIN_ATTEMPTS", "10"))
    RATE_LIMIT_LOGIN_WINDOW_SEC: int = int(os.getenv("RATE_LIMIT_LOGIN_WINDOW_SEC", "300"))

    # Uploads
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "100"))

settings = Settings()
