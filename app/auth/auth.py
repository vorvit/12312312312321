from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User
from app.cache.cache_service import CacheService
from config import settings
import uuid
import json

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str) -> Optional[dict]:
        """Verify JWT token and return payload"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except JWTError:
            return None
    
    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
        """Authenticate user with email and password"""
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None
        if not AuthService.verify_password(password, user.hashed_password):
            return None
        return user
    
    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        """Get user by email with Redis caching"""
        # Try to get from cache first
        cache = CacheService()
        cache_key = f"user:email:{email}"
        cached_user = cache.get(cache_key)
        
        if cached_user and isinstance(cached_user, dict):
            # Return user object from cache
            user = User()
            for key, value in cached_user.items():
                if hasattr(user, key):
                    setattr(user, key, value)
            return user
        
        # Get from database
        user = db.query(User).filter(User.email == email).first()
        
        if user:
            # Cache user data for 5 minutes
            user_data = {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "is_active": user.is_active,
                "is_admin": user.is_admin,
                "is_email_verified": user.is_email_verified,
                "full_name": user.full_name,
                "oauth_provider": user.oauth_provider,
                "oauth_id": user.oauth_id,
                "avatar_url": user.avatar_url,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login": user.last_login.isoformat() if user.last_login else None
            }
            cache.set(cache_key, user_data, expire=300)  # 5 minutes
        
        return user
    
    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
        """Get user by ID with Redis caching"""
        # Try to get from cache first
        cache = CacheService()
        cache_key = f"user:id:{user_id}"
        cached_user = cache.get(cache_key)
        
        if cached_user and isinstance(cached_user, dict):
            # Return user object from cache
            user = User()
            for key, value in cached_user.items():
                if hasattr(user, key):
                    setattr(user, key, value)
            return user
        
        # Get from database
        user = db.query(User).filter(User.id == user_id).first()
        
        if user:
            # Cache user data for 5 minutes
            user_data = {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "is_active": user.is_active,
                "is_admin": user.is_admin,
                "is_email_verified": user.is_email_verified,
                "full_name": user.full_name,
                "oauth_provider": user.oauth_provider,
                "oauth_id": user.oauth_id,
                "avatar_url": user.avatar_url,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login": user.last_login.isoformat() if user.last_login else None
            }
            cache.set(cache_key, user_data, expire=300)  # 5 minutes
        
        return user
    
    @staticmethod
    def create_password_reset_token() -> str:
        """Create a password reset token"""
        return str(uuid.uuid4())
    
    @staticmethod
    def verify_password_reset_token(token: str) -> bool:
        """Verify password reset token format"""
        try:
            uuid.UUID(token)
            return True
        except ValueError:
            return False
