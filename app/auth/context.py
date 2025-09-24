from typing import Optional
from fastapi import Request, HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.auth import AuthService
from app.models.user import User


def get_user_from_request(request: Request, db: Session) -> Optional[User]:
    """Extract current user from Authorization: Bearer or access_token cookie.
    Returns None if not authenticated or invalid.
    """
    token: Optional[str] = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        return None
    payload = AuthService.verify_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return AuthService.get_user_by_id(db, int(user_id))


def require_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = get_user_from_request(request, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


def require_admin_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = require_current_user(request, db)
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return user



