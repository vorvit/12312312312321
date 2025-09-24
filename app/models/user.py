from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.base import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_email_verified = Column(Boolean, default=False)
    email_verification_token = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # OAuth fields
    oauth_provider = Column(String(50), nullable=True)  # 'google', 'yandex'
    oauth_id = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Additional fields for IFC service
    storage_quota = Column(Integer, default=1073741824)  # 1GB in bytes
    used_storage = Column(Integer, default=0)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user")
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"
