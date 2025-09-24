import secrets
from fastapi import Request, HTTPException, status
from typing import Optional

from config import settings


CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"


def ensure_csrf_cookie(request: Request) -> Optional[str]:
    """Return existing CSRF token or create a new one. Doesn't set cookie by itself.
    Caller should set cookie on response when a new token is created.
    """
    token = request.cookies.get(CSRF_COOKIE_NAME)
    if not token:
        token = secrets.token_urlsafe(32)
    return token


def verify_csrf(request: Request) -> None:
    """Double-submit token check: token in cookie must match header for unsafe methods."""
    if not settings.CSRF_ENABLED:
        return
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
    header_token = request.headers.get(CSRF_HEADER_NAME)
    if not cookie_token or not header_token or cookie_token != header_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")



