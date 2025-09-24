from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from datetime import datetime

# User schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    is_email_verified: bool
    created_at: datetime
    storage_quota: Optional[int] = None
    used_storage: Optional[int] = None
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Auth schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# Admin schemas
class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int
    page: int
    size: int

class UserStats(BaseModel):
    total_users: int
    active_users: int
    admin_users: int
    total_files: int
    total_storage_used: int

# System settings schemas
class SystemSettings(BaseModel):
    site_name: str
    default_quota: float
    session_timeout: int
    require_email_verification: bool
    max_file_size: int
    max_login_attempts: int

class SystemSettingsUpdate(BaseModel):
    site_name: Optional[str] = None
    default_quota: Optional[float] = None
    session_timeout: Optional[int] = None
    require_email_verification: Optional[bool] = None
    max_file_size: Optional[int] = None
    max_login_attempts: Optional[int] = None

# Password reset schemas
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
    confirm_password: str
    
    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v

# Email verification schemas
class EmailVerificationRequest(BaseModel):
    token: str

class EmailVerificationResponse(BaseModel):
    message: str
    verified: bool

# Backup schemas
class BackupCreateRequest(BaseModel):
    backup_type: str = "full"  # full|database|files
    compression: str = "zip"   # zip|tar|none
    include_user_files: bool = True

class BackupCreateResponse(BaseModel):
    message: str
    backup_id: str
    filename: str
    download_url: str
    type: str
    compression: str
    size: int

# Health check schemas
class ServiceHealth(BaseModel):
    status: str  # healthy|unhealthy|degraded
    type: Optional[str] = None
    host: Optional[str] = None
    endpoint: Optional[str] = None
    url: Optional[str] = None
    error: Optional[str] = None
    buckets: Optional[int] = None
    bucket_name: Optional[str] = None
    db: Optional[int] = None
    database: Optional[str] = None

class HealthResponse(BaseModel):
    overall_status: str
    services: dict[str, ServiceHealth]
    timestamp: float
    uptime_sec: Optional[float] = None
    version: Optional[str] = None

# Log schemas
class LogEntry(BaseModel):
    timestamp: str
    level: str
    message: str
    user_id: Optional[int] = None
    action: Optional[str] = None

class LogStats(BaseModel):
    total_logs: int
    auth_logs: int
    file_logs: int
    admin_logs: int
    error_logs: int
    last_24h: int

# Login history schemas
class LoginHistoryEntry(BaseModel):
    timestamp: str
    ip_address: str
    user_agent: str
    success: bool

class LoginHistoryResponse(BaseModel):
    login_history: list[LoginHistoryEntry]
