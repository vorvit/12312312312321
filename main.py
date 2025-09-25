from fastapi import FastAPI, Depends, HTTPException, status, Request, UploadFile, File, Cookie, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse, Response, FileResponse, JSONResponse
from sqlalchemy.orm import Session
from datetime import timedelta
import uvicorn
import io

from app.database import engine, get_db, Base
from app.models.user import User
from app.auth.auth import AuthService
from app.auth.dependencies import get_current_active_user, get_current_admin_user, get_current_admin_user_from_cookie, get_current_active_user_from_cookie
from app.auth.context import require_current_user, require_admin_user, get_user_from_request
from app.storage.service import StorageService
from app.cache.cache_service import CacheService
from app.schemas import (
    UserCreate, UserResponse, LoginRequest, Token, UserUpdate, UserListResponse, UserStats,
    PasswordResetRequest, PasswordResetConfirm, EmailVerificationRequest, EmailVerificationResponse,
    SystemSettings, SystemSettingsUpdate, BackupCreateRequest, BackupCreateResponse,
    HealthResponse, ServiceHealth, LogStats, LoginHistoryResponse
)
from app.storage import MinIOClient
from app.email.email_service import email_service
from app.models.password_reset import PasswordResetToken
from app.models.file import File as FileModel
from app.auth.oauth_service import OAuthService
from app.services.health_check import HealthCheckService
from app.logging.logger import logger
from config import settings
from fastapi import BackgroundTasks
from fastapi.exceptions import RequestValidationError
import uuid
from datetime import datetime, timedelta
import time
import httpx
from app.security.rate_limit import LoginRateLimiter
from app.security.csrf import ensure_csrf_cookie, verify_csrf, CSRF_COOKIE_NAME
from app.api.responses import api_ok, api_error
from app.api.mock_files import router as mock_files_router
import subprocess
import tempfile
import os

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="IFC Auth Service",
    description="Authentication and authorization service for IFC web platform",
    version="1.0.0"
)

APP_START_TIME = time.monotonic()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files and templates
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# Добавляем обслуживание WASM файлов для IFC загрузчика
app.mount("/web-ifc", StaticFiles(directory="TSP/public/web-ifc"), name="web-ifc")

# Middleware для правильных MIME-типов WASM файлов
@app.middleware("http")
async def add_mime_types(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.endswith(".wasm"):
        response.headers["Content-Type"] = "application/wasm"
    return response

# Global API error handlers (JSON envelope)
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if request.url.path.startswith("/api/") or request.url.path.startswith("/auth/"):
        return JSONResponse(status_code=exc.status_code, content=api_error(exc.detail, status=exc.status_code))
    # For non-API routes, return HTML error page or redirect
    if exc.status_code == 401:
        return RedirectResponse(url="/login", status_code=302)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    if request.url.path.startswith("/api/") or request.url.path.startswith("/auth/"):
        return JSONResponse(status_code=422, content=api_error("Validation error", details=exc.errors(), status=422))
    raise exc


@app.middleware("http")
async def unhandled_exception_envelope(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except HTTPException:
        # Let HTTPException be handled by the exception handler
        raise
    except Exception as e:
        if request.url.path.startswith("/api/"):
            logger.log_error(f"Unhandled error: {e}")
            return JSONResponse(status_code=500, content=api_error("Internal server error", details=str(e), status=500))
        raise


# Request logging middleware (method, path, status, duration)
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = int((time.perf_counter() - start) * 1000)
    try:
        db = next(get_db())
        user = get_user_from_request(request, db)
        user_id = user.id if user else None
    except Exception:
        user_id = None
    path = request.url.path
    method = request.method
    status_code = response.status_code
    msg = f"{method} {path} -> {status_code} in {duration_ms}ms"
    # Log to main/admin log; using admin action for visibility in UI
    try:
        logger.log_admin_action(msg, user_id, "REQUEST")
    except Exception:
        pass
    return response


# Ensure CSRF cookie exists on HTML GET pages
@app.middleware("http")
async def ensure_csrf_cookie_middleware(request: Request, call_next):
    response = await call_next(request)
    try:
        if request.method == "GET" and not request.url.path.startswith("/api/"):
            token = ensure_csrf_cookie(request)
            if token and request.cookies.get(CSRF_COOKIE_NAME) != token:
                response.set_cookie(CSRF_COOKIE_NAME, token, httponly=False, samesite=settings.COOKIE_SAMESITE, secure=settings.COOKIE_SECURE)
    except Exception:
        pass
    return response

# Helper: extract current user from Authorization header or access_token cookie
def _get_user_from_request(request: Request) -> User | None:
    try:
        # Try header first
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        # Fallback to cookie
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
        db = next(get_db())
        try:
            return AuthService.get_user_by_id(db, int(user_id))
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception:
        return None

# Web interface routes
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Home page"""
    return templates.TemplateResponse("base.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Login page"""
    # Ensure CSRF token exists; set via response after render
    token = ensure_csrf_cookie(request)
    resp = templates.TemplateResponse("login.html", {"request": request})
    if token and request.cookies.get(CSRF_COOKIE_NAME) != token:
        resp.set_cookie(CSRF_COOKIE_NAME, token, httponly=False, samesite=settings.COOKIE_SAMESITE, secure=settings.COOKIE_SECURE)
    return resp

@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    """Register page"""
    return templates.TemplateResponse("register.html", {"request": request})

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    """User dashboard page"""
    return templates.TemplateResponse("dashboard.html", {
        "request": request
    })

@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request):
    """Admin panel page"""
    return templates.TemplateResponse("admin.html", {
        "request": request
    })

@app.get("/forgot-password", response_class=HTMLResponse)
async def forgot_password_page(request: Request):
    """Forgot password page"""
    return templates.TemplateResponse("forgot-password.html", {
        "request": request
    })

@app.get("/reset-password", response_class=HTMLResponse)
async def reset_password_page(request: Request, token: str = None):
    """Reset password page"""
    return templates.TemplateResponse("reset-password.html", {
        "request": request,
        "token": token
    })

# (Deprecated) Simple health removed; using detailed /health below

# Check authentication endpoint
@app.get("/auth/check")
async def check_auth(request: Request):
    """Check if user is authenticated"""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = AuthService.verify_token(token)
        if payload:
            user_id = payload.get("sub")
            if user_id:
                db = next(get_db())
                user = AuthService.get_user_by_id(db, user_id=int(user_id))
                if user:
                    return {"authenticated": True, "user": user}
    return {"authenticated": False}

# Password reset endpoints
@app.post("/auth/forgot-password")
async def forgot_password(request: PasswordResetRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Request password reset"""
    user = AuthService.get_user_by_email(db, request.email)
    if not user:
        # Don't reveal if user exists or not
        return {"message": "If the email exists, a password reset link has been sent."}
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=1)
    
    # Store reset token in database
    reset_token_obj = PasswordResetToken(
        user_id=user.id,
        token=reset_token,
        expires_at=expires_at
    )
    
    db.add(reset_token_obj)
    db.commit()
    
    # Send password reset email
    await email_service.send_password_reset(
        email=user.email,
        username=user.username,
        reset_token=reset_token,
        background_tasks=background_tasks
    )
    
    return {"message": "Password reset link has been sent to your email."}

@app.post("/auth/reset-password")
async def reset_password(request: PasswordResetConfirm, db: Session = Depends(get_db)):
    """Reset password with token"""
    # Find reset token in database
    reset_token_obj = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == request.token,
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).first()
    
    if not reset_token_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Get user
    user = db.query(User).filter(User.id == reset_token_obj.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    # Update password
    user.hashed_password = AuthService.get_password_hash(request.new_password)
    
    # Mark token as used
    reset_token_obj.used = True
    
    db.commit()
    
    return {"message": "Password successfully reset!"}

# Auth endpoints
@app.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user already exists
    existing_user = AuthService.get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username already exists
    existing_username = db.query(User).filter(User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Generate email verification token
    verification_token = str(uuid.uuid4())
    
    # Create new user
    hashed_password = AuthService.get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        email_verification_token=verification_token,
        is_email_verified=False
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Send welcome email with credentials
    await email_service.send_welcome_email(
        email=db_user.email,
        username=db_user.username,
        password=user_data.password,  # Send plain password for first login
        background_tasks=background_tasks
    )
    
    # Send email verification
    await email_service.send_email_verification(
        email=db_user.email,
        username=db_user.username,
        verification_token=verification_token,
        background_tasks=background_tasks
    )
    
    return db_user

rate_limiter = LoginRateLimiter(settings.RATE_LIMIT_LOGIN_ATTEMPTS, settings.RATE_LIMIT_LOGIN_WINDOW_SEC)


@app.post("/auth/login", response_model=Token)
async def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    """Login user and return access token"""
    verify_csrf(request)
    # rate limit
    rate_limiter.check(request, login_data.email)
    user = AuthService.authenticate_user(db, login_data.email, login_data.password)
    if not user:
        logger.log_auth(f"Неудачная попытка входа с email: {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = AuthService.create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    logger.log_auth(f"Успешный вход пользователя", user.id, "LOGIN")
    # Return JSON and also set HttpOnly cookie for HTML routes
    resp = JSONResponse({"access_token": access_token, "token_type": "bearer"})
    resp.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        max_age=int(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
        secure=settings.COOKIE_SECURE
    )
    return resp

@app.post("/auth/verify-email", response_model=EmailVerificationResponse)
async def verify_email(request: EmailVerificationRequest, db: Session = Depends(get_db)):
    """Verify user email with token"""
    user = db.query(User).filter(User.email_verification_token == request.token).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )
    
    if user.is_email_verified:
        return EmailVerificationResponse(
            message="Email already verified",
            verified=True
        )
    
    # Mark email as verified
    user.is_email_verified = True
    user.email_verification_token = None
    db.commit()
    
    return EmailVerificationResponse(
        message="Email successfully verified!",
        verified=True
    )

@app.get("/verify-email", response_class=HTMLResponse)
async def verify_email_page(request: Request, token: str = None):
    """Email verification page"""
    if not token:
        return templates.TemplateResponse("verify-email-error.html", {
            "request": request,
            "error": "No verification token provided"
        })
    
    # Verify token
    db = next(get_db())
    user = db.query(User).filter(User.email_verification_token == token).first()
    
    if not user:
        return templates.TemplateResponse("verify-email-error.html", {
            "request": request,
            "error": "Invalid verification token"
        })
    
    if user.is_email_verified:
        return templates.TemplateResponse("verify-email-success.html", {
            "request": request,
            "message": "Email already verified"
        })
    
    # Mark as verified
    user.is_email_verified = True
    user.email_verification_token = None
    db.commit()
    
    return templates.TemplateResponse("verify-email-success.html", {
        "request": request,
        "message": "Email successfully verified!"
    })

@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user

# User dashboard endpoints
@app.get("/dashboard")
async def dashboard(current_user: User = Depends(get_current_active_user)):
    """User dashboard page"""
    return {
        "user": current_user,
        "storage_used_percent": (current_user.used_storage / current_user.storage_quota) * 100,
        "storage_remaining": current_user.storage_quota - current_user.used_storage
    }

# User management endpoints
@app.get("/users/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user information"""
    # Получаем актуальные данные из БД
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/users/login-history", response_model=LoginHistoryResponse)
async def get_user_login_history(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user login history"""
    # For now, we'll simulate login history since we don't have a separate login_history table
    # In a real implementation, you would have a login_history table
    login_history = [
        {
            "timestamp": (current_user.last_login or datetime.now()).isoformat(),
            "ip_address": "127.0.0.1",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "success": True
        }
    ]
    
    # Add some mock historical data for demonstration
    if current_user.last_login:
        from datetime import timedelta
        for i in range(1, 6):  # Add 5 more entries
            login_time = current_user.last_login - timedelta(days=i*2, hours=i)
            login_history.append({
                "timestamp": login_time.isoformat(),
                "ip_address": f"192.168.1.{100 + i}",
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "success": True
            })
    
    return LoginHistoryResponse(login_history=login_history)

@app.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    """User profile page"""
    # Try to get user from cookie first, then from Authorization header
    try:
        current_user = await get_current_active_user_from_cookie(request)
    except:
        try:
            current_user = await get_current_active_user(request)
        except:
            # If no authentication, redirect to login
            return RedirectResponse(url="/login", status_code=302)
    
    return templates.TemplateResponse("profile.html", {
        "request": request,
        "user": current_user
    })

@app.get("/ifc-viewer", response_class=HTMLResponse)
async def ifc_viewer_page(request: Request):
    """IFC Viewer page - redirects to TSP viewer"""
    # Get filename from query parameters
    filename = request.query_params.get("file")
    
    # Try to get token from cookie (most reliable for web requests)
    token = request.cookies.get("access_token")
    
    # If no token in cookie, try Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    # Build TSP viewer URL with token and file
    from urllib.parse import quote
    safe_token = quote(token, safe="") if token else None
    safe_file = quote(filename, safe="") if filename else None

    if safe_token and safe_file:
        tsp_url = f"http://localhost:5174?token={safe_token}&file={safe_file}"
    elif safe_file:
        # If token not found in cookie/header, still forward only file; viewer will request auth if needed
        tsp_url = f"http://localhost:5174?file={safe_file}"
    elif safe_token:
        tsp_url = f"http://localhost:5174?token={safe_token}"
    else:
        tsp_url = "http://localhost:5174"
    
    return RedirectResponse(url=tsp_url, status_code=302)

# Admin endpoints
@app.get("/api/admin/users", response_model=None)
async def get_users(
    page: int = 1,
    size: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Get all users (admin only)"""
    offset = (page - 1) * size
    users = db.query(User).offset(offset).limit(size).all()
    total = db.query(User).count()
    return api_ok({
        "users": users,
        "total": total,
        "page": page,
        "size": size
    })

@app.get("/admin/stats")
async def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Get admin statistics"""
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    admin_users = db.query(User).filter(User.is_admin == True).count()
    total_storage_used = db.query(User).with_entities(User.used_storage).all()
    total_storage_used = sum([(row[0] or 0) for row in total_storage_used])
    
    # total files: count files per user from MinIO if available
    total_files = 0
    try:
        from app.storage import MinIOClient
        minio_client = MinIOClient()
        # If MinIO not connected, keep 0
        # Simple heuristic: count objects in each user_*/ prefix
        users = db.query(User).with_entities(User.id).all()
        for (uid,) in users:
            try:
                files = minio_client.get_user_files(uid)
                total_files += len(files)
            except Exception:
                continue
    except Exception:
        total_files = 0
    
    return api_ok({
        "total_users": total_users,
        "active_users": active_users,
        "admin_users": admin_users,
        "total_files": total_files,
        "total_storage_used": total_storage_used
    })

# Logs endpoints for admin
@app.get("/admin/logs")
async def get_logs(
    log_type: str = "main",
    limit: int = 100,
    current_user: User = Depends(require_admin_user)
):
    """Get system logs for admin panel"""
    logs = logger.get_logs(log_type, limit)
    return api_ok({"logs": logs, "log_type": log_type, "limit": limit})

@app.get("/admin/logs/stats", response_model=LogStats)
async def get_log_stats(current_user: User = Depends(require_admin_user)):
    """Get log statistics"""
    stats = logger.get_log_stats()
    return LogStats(**stats)

# Admin user management endpoints
@app.post("/api/admin/users/create")
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Create a new user (admin only)"""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    db_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=AuthService.get_password_hash(user_data.password),
        is_active=True,
        is_admin=False,
        storage_quota=1073741824  # 1GB default
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    logger.log_admin_action(f"Создан новый пользователь: {user_data.email}", current_user.id, "USER_CREATE")
    return api_ok({"user_id": db_user.id}, message="User created successfully")

@app.put("/api/admin/users/{user_id}")
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Update user information (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update user fields
    if user_data.email:
        user.email = user_data.email
    if user_data.username:
        user.username = user_data.username
    if user_data.password:
        user.hashed_password = AuthService.get_password_hash(user_data.password)
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.is_admin is not None:
        user.is_admin = user_data.is_admin
    if user_data.storage_quota is not None:
        user.storage_quota = user_data.storage_quota
    
    db.commit()
    logger.log_admin_action(f"Обновлен пользователь {user_id}: {user.email}", current_user.id, "USER_UPDATE")
    return api_ok(message="User updated successfully")

@app.post("/api/admin/users/{user_id}/toggle")
async def toggle_user_status(
    user_id: int,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Toggle user active status (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = request.get("active", not user.is_active)
    db.commit()
    
    status = "активирован" if user.is_active else "деактивирован"
    logger.log_admin_action(f"Пользователь {user.email} {status}", current_user.id, "USER_TOGGLE")
    return api_ok(message=f"User {'activated' if user.is_active else 'deactivated'} successfully")

@app.delete("/api/admin/users/{user_id}/delete")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Delete user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow deleting self
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Delete user files from MinIO
    try:
        from app.storage import MinIOClient
        minio_client = MinIOClient()
        minio_client.delete_user_folder(user_id)
    except Exception as e:
        logger.log_error(f"Ошибка удаления файлов пользователя {user_id}: {str(e)}")
    
    db.delete(user)
    db.commit()
    
    logger.log_admin_action(f"Удален пользователь: {user.email}", current_user.id, "USER_DELETE")
    return api_ok(message="User deleted successfully")

@app.get("/api/admin/users/export")
async def export_users(
    search: str = None,
    status: str = None,
    role: str = None,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db)
):
    """Export users to CSV with filters (admin only)"""
    # Build query with filters
    query = db.query(User)
    
    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.username.ilike(search_term)) |
            (User.email.ilike(search_term))
        )
    
    # Apply status filter
    if status == "active":
        query = query.filter(User.is_active == True)
    elif status == "inactive":
        query = query.filter(User.is_active == False)
    
    # Apply role filter
    if role == "admin":
        query = query.filter(User.is_admin == True)
    elif role == "user":
        query = query.filter(User.is_admin == False)
    
    users = query.all()
    
    # Generate filename with filters
    filename_parts = ["users"]
    if search:
        filename_parts.append(f"search_{search[:10]}")
    if status:
        filename_parts.append(status)
    if role:
        filename_parts.append(role)
    filename = "_".join(filename_parts) + ".csv"
    
    # Generate CSV content
    csv_content = "ID,Email,Username,Active,Admin,Storage Quota (GB),Used Storage (MB),Last Login\n"
    for user in users:
        storage_quota_gb = round(user.storage_quota / (1024**3), 2) if user.storage_quota else 0
        used_storage_mb = round(user.used_storage / (1024**2), 2) if user.used_storage else 0
        last_login = user.last_login.strftime("%Y-%m-%d %H:%M:%S") if user.last_login else "Never"
        
        csv_content += f"{user.id},{user.email},{user.username},{user.is_active},{user.is_admin},{storage_quota_gb},{used_storage_mb},{last_login}\n"
    
    # Log export action with filter details
    filter_details = []
    if search:
        filter_details.append(f"search='{search}'")
    if status:
        filter_details.append(f"status='{status}'")
    if role:
        filter_details.append(f"role='{role}'")
    
    filter_str = f" с фильтрами: {', '.join(filter_details)}" if filter_details else ""
    logger.log_admin_action(f"Экспорт списка пользователей{filter_str} ({len(users)} записей)", current_user.id, "USER_EXPORT")
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# System settings endpoints
@app.get("/admin/settings")
async def get_system_settings(current_user: User = Depends(require_admin_user)):
    """Get system settings (admin only)"""
    return api_ok({
        "site_name": "IFC Auth Service",
        "default_quota": 1.0,
        "session_timeout": 60,
        "require_email_verification": True,
        "max_file_size": 100,
        "max_login_attempts": 5
    })

@app.put("/admin/settings")
async def update_system_settings(
    settings: SystemSettingsUpdate,
    current_user: User = Depends(require_admin_user)
):
    """Update system settings (admin only)"""
    # In a real implementation, you would save these to a settings table or config file
    logger.log_admin_action(f"Обновлены системные настройки: {settings}", current_user.id, "SETTINGS_UPDATE")
    return api_ok(message="Settings updated successfully")

# Backup endpoints
@app.post("/admin/backup")
async def create_backup(
    backup_data: BackupCreateRequest,
    current_user: User = Depends(require_admin_user)
):
    """Create system backup (admin only)"""
    import zipfile
    import tempfile
    import os
    from pathlib import Path
    
    backup_type = backup_data.backup_type
    compression = backup_data.compression
    include_user_files = backup_data.include_user_files
    
    try:
        # Create temporary backup file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"backup_{backup_type}_{timestamp}.{compression}"
        
        # Create backup directory
        backup_dir = Path("backups")
        backup_dir.mkdir(exist_ok=True)
        backup_path = backup_dir / backup_filename
        
        if compression == "zip":
            with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add database file
                if os.path.exists("auth.db"):
                    zipf.write("auth.db", "database/auth.db")
                
                # Add logs
                logs_dir = Path("logs")
                if logs_dir.exists():
                    for log_file in logs_dir.glob("*.log"):
                        zipf.write(log_file, f"logs/{log_file.name}")
                
                # Add user files if requested
                if include_user_files and backup_type in ["full", "files"]:
                    # This would include MinIO files in a real implementation
                    zipf.writestr("user_files/README.txt", "User files would be included here in production")
                
                # Add configuration files
                config_files = [".env", "config.py", "requirements.txt"]
                for config_file in config_files:
                    if os.path.exists(config_file):
                        zipf.write(config_file, f"config/{config_file}")
        
        # Log backup creation
        logger.log_admin_action(f"Создан бэкап: {backup_type} с сжатием {compression} ({backup_path.name})", current_user.id, "BACKUP_CREATE")
        
        return api_ok({
            "message": "Backup created successfully",
            "backup_id": f"backup_{timestamp}",
            "filename": backup_filename,
            "download_url": f"/admin/backup/download/{backup_filename}",
            "type": backup_type,
            "compression": compression,
            "size": os.path.getsize(backup_path) if backup_path.exists() else 0
        })
        
    except Exception as e:
        logger.log_error(f"Ошибка создания бэкапа: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backup creation failed: {str(e)}")

@app.get("/admin/backup/download/{filename}")
async def download_backup(
    filename: str,
    request: Request,
    token: str = None,
    current_user: User = Depends(require_admin_user)
):
    """Download backup file (admin only)"""
    import os
    from pathlib import Path
    
    # Security check - only allow backup files
    if not filename.endswith(('.zip', '.tar', '.gz')):
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    backup_path = Path("backups") / filename
    
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="Backup file not found")
    
    # Log download
    logger.log_admin_action(f"Скачан бэкап: {filename}", current_user.id, "BACKUP_DOWNLOAD")
    
    # Read file content
    with open(backup_path, 'rb') as f:
        content = f.read()
    
    return Response(
        content=content,
        media_type='application/zip',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Length': str(len(content)),
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        }
    )

@app.get("/admin/backup/list")
async def list_backups(current_user: User = Depends(require_admin_user)):
    """List available backups (admin only)"""
    # In a real implementation, you would list actual backup files
    return api_ok({
        "backups": [
            {
                "id": "backup_1",
                "created": "2025-09-23T10:00:00Z",
                "type": "full",
                "size": "2.5GB"
            }
        ]
    })

# File storage endpoints
@app.post("/files/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None,
):
    """Upload a file to user's storage"""
    try:
        # Read file content (for validation and upload)
        raw_bytes = await file.read()
        
        # Validate filename
        import os, re
        original_name = file.filename or ""
        safe_name = os.path.basename(original_name)
        # allow letters, numbers, dash, underscore, dot
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", safe_name)
        if not safe_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")
        
        # Validate extension and size
        allowed_ext = {"ifc", "ifcxml", "ifczip"}
        ext = safe_name.lower().split(".")[-1] if "." in safe_name else ""
        if ext not in allowed_ext:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")
        
        size_bytes = len(raw_bytes)
        max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
        if size_bytes > max_bytes:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"File exceeds {settings.MAX_UPLOAD_MB}MB limit")
        
        # Optionally validate MIME (best-effort)
        allowed_mime = {"application/ifc", "application/xml", "application/zip", "application/octet-stream"}
        content_type = file.content_type or "application/octet-stream"
        if content_type not in allowed_mime:
            # allow xml for ifcxml, zip for ifczip, octet-stream fallback
            pass
        
        # Check storage quota
        storage = StorageService()
        current_usage = storage.get_user_usage(current_user.id)
        
        # Ensure storage_quota is not None, use default if it is
        storage_quota = current_user.storage_quota or 1073741824  # 1GB default
        
        if current_usage + size_bytes > storage_quota:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds storage quota"
            )
        
        # Upload file
        file_data = io.BytesIO(raw_bytes)
        success = storage.upload_user_file(current_user.id, safe_name, file_data, content_type)
        
        if success:
            # Add file record to database
            file_record = FileModel(
                user_id=current_user.id,
                filename=safe_name,
                original_filename=original_name,
                file_size=size_bytes,
                content_type=content_type,
                storage_path=f"user_{current_user.id}/{safe_name}",
                is_public=False
            )
            db.add(file_record)
            
            # Update user storage usage
            new_usage = storage.get_user_usage(current_user.id)
            logger.log_file_operation(f"Обновление used_storage: {current_user.used_storage} -> {new_usage}", current_user.id, file.filename, "UPDATE")
            
            # Получаем пользователя из текущей сессии
            user = db.query(User).filter(User.id == current_user.id).first()
            if user:
                user.used_storage = new_usage
            db.commit()
            
            # Invalidate cached list
            try:
                CacheService().delete(f"files:list:{current_user.id}")
            except Exception:
                pass
            logger.log_file_operation(f"Файл успешно загружен", current_user.id, safe_name, "UPLOAD")

            # Schedule background FRAG conversion
            try:
                if background_tasks is not None:
                    background_tasks.add_task(convert_ifc_to_frag_task, current_user.id, safe_name)
            except Exception as conv_err:
                logger.log_error(f"Не удалось поставить задачу конвертации FRAG: {conv_err}")

            return api_ok({"filename": safe_name, "size": size_bytes}, message="File uploaded successfully")
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file"
            )
    except Exception as e:
        logger.log_error(f"Ошибка загрузки файла: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# --- IFC -> FRAG conversion utilities ---

def convert_ifc_to_frag_task(user_id: int, ifc_filename: str) -> None:
    """Background task: download IFC, convert to FRAG using Node script, upload FRAG back."""
    try:
        storage = StorageService()
        # Download IFC to temp
        with tempfile.TemporaryDirectory() as tmpdir:
            in_path = os.path.join(tmpdir, ifc_filename)
            out_path = os.path.join(tmpdir, os.path.splitext(ifc_filename)[0] + ".frag")
            
            # Read bytes from storage
            ifc_bytes = storage.download_user_file(user_id, ifc_filename)
            with open(in_path, "wb") as f:
                f.write(ifc_bytes)
            
            # Run Node converter script
            node_cmd = os.environ.get("NODE_BIN", "node")
            script_path = os.path.abspath(os.path.join("TSP", "scripts", "ifc2frag.cjs"))
            try:
                result = subprocess.run([node_cmd, script_path, in_path, out_path], capture_output=True, text=True, cwd=os.path.abspath("TSP"), timeout=600)
                if result.returncode != 0:
                    logger.log_error(f"FRAG conversion failed: {result.stderr}")
                    return
            except Exception as run_err:
                logger.log_error(f"FRAG conversion exception: {run_err}")
                return
            
            # Upload FRAG back to storage
            if os.path.exists(out_path):
                with open(out_path, "rb") as f:
                    frag_bytes = f.read()
                storage.upload_user_file(user_id, os.path.splitext(ifc_filename)[0] + ".frag", io.BytesIO(frag_bytes), "application/octet-stream")
                # Optionally store DB record
                db = next(get_db())
                try:
                    frag_record = FileModel(
                        user_id=user_id,
                        filename=os.path.splitext(ifc_filename)[0] + ".frag",
                        original_filename=os.path.splitext(ifc_filename)[0] + ".frag",
                        file_size=len(frag_bytes),
                        content_type="application/octet-stream",
                        storage_path=f"user_{user_id}/{os.path.splitext(ifc_filename)[0] + '.frag'}",
                        is_public=False
                    )
                    db.add(frag_record)
                    db.commit()
                    CacheService().delete(f"files:list:{user_id}")
                    logger.log_file_operation("FRAG создан и загружен", user_id, frag_record.filename, "CONVERT")
                except Exception as db_err:
                    logger.log_error(f"DB error while adding FRAG record: {db_err}")
    except Exception as e:
        logger.log_error(f"convert_ifc_to_frag_task error: {e}")

@app.post("/api/files/convert/{filename}")
async def convert_ifc_to_frag(filename: str, current_user: User = Depends(require_current_user)):
    """Manually trigger IFC->FRAG conversion for a user's file."""
    background_tasks = BackgroundTasks()
    background_tasks.add_task(convert_ifc_to_frag_task, current_user.id, filename)
    return api_ok({"scheduled": True, "filename": filename}, message="Conversion scheduled")

@app.get("/api/files")
async def list_files(current_user: User = Depends(require_current_user)):
    """List user's files"""
    try:
        cache = CacheService()
        cache_key = f"files:list:{current_user.id}"
        files = cache.get(cache_key)
        if files is None:
            # Get files from database
            db = next(get_db())
            try:
                db_files = db.query(FileModel).filter(FileModel.user_id == current_user.id).all()
                files = []
                for file in db_files:
                    files.append({
                        "id": file.id,
                        "name": file.filename,
                        "original_name": file.original_filename,
                        "size": file.file_size,
                        "content_type": file.content_type,
                        "created_at": file.created_at.isoformat() if file.created_at else None,
                        "is_public": file.is_public
                    })
            finally:
                db.close()
            cache.set(cache_key, files, expire=60)
        logger.log_file_operation(f"Запрос списка файлов", current_user.id, "", "LIST")
        return api_ok(files)
    except Exception as e:
        logger.log_error(f"Ошибка получения списка файлов: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/files/download/{filename}")
async def download_file(
    filename: str,
    request: Request,
    current_user: User = Depends(require_current_user)
):
    """Download a file"""
    try:
        storage = StorageService()
        file_data = storage.download_user_file(current_user.id, filename)
        
        if file_data is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        return StreamingResponse(
            io.BytesIO(file_data),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.head("/files/download/{filename}")
async def head_download_file(
    filename: str,
    request: Request,
    current_user: User = Depends(require_current_user)
):
    try:
        storage = StorageService()
        file_data = storage.download_user_file(current_user.id, filename)
        if file_data is None:
            return Response(status_code=404)
        return Response(
            status_code=200,
            headers={
                "Content-Type": "application/octet-stream",
                "Content-Disposition": f"attachment; filename={filename}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(len(file_data))
            }
        )
    except Exception:
        return Response(status_code=500)

@app.get("/api/files/download/{filename}")
async def download_file_with_token(
    filename: str,
    request: Request
):
    """Download a file with token authentication for TSP viewer"""
    # Get token from query parameters
    token = request.query_params.get("token")
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token required"
        )
    
    # Verify token and get user
    try:
        from jose import jwt
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    # Get user from database
    db = next(get_db())
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    storage = StorageService()
    file_data = storage.download_user_file(user.id, filename)
    
    if file_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Normalize filename for Windows compatibility
    import os
    import tempfile
    import shutil
    
    # Create a temporary file with normalized name
    temp_dir = tempfile.mkdtemp()
    normalized_filename = filename.replace(' ', '_').replace(':', '_')
    temp_file_path = os.path.join(temp_dir, normalized_filename)
    
    try:
        # Write file data to temp location with normalized name
        with open(temp_file_path, 'wb') as f:
            f.write(file_data)
        
        response = FileResponse(
            path=temp_file_path,
            filename=normalized_filename,
            media_type="application/octet-stream"
        )
        
        # Add CORS headers to prevent browser blocking
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-CSRF-Token"
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        
        return response
    except Exception as e:
        # Clean up temp directory on error
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise e

@app.head("/api/files/download/{filename}")
async def head_download_file_with_token(
    filename: str,
    request: Request
):
    token = request.query_params.get("token")
    if not token:
        return Response(status_code=401)
    try:
        from jose import jwt
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: int = payload.get("sub")
        if not user_id:
            return Response(status_code=401)
    except Exception:
        return Response(status_code=401)
    storage = StorageService()
    file_data = storage.download_user_file(user_id, filename)
    if file_data is None:
        return Response(status_code=404)
    return Response(
        status_code=200,
        headers={
            "Content-Type": "application/octet-stream",
            "Content-Disposition": f"attachment; filename={filename}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(len(file_data))
        }
    )

@app.get("/files/view/{filename}")
async def view_file(
    filename: str,
    current_user: User = Depends(require_current_user)
):
    """View a file in browser"""
    try:
        storage = StorageService()
        file_data = storage.download_user_file(current_user.id, filename)
        
        if file_data is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Determine content type based on file extension
        content_type = "application/octet-stream"
        if filename.lower().endswith('.ifc'):
            content_type = "application/ifc"
        elif filename.lower().endswith('.ifcxml'):
            content_type = "application/xml"
        elif filename.lower().endswith('.ifczip'):
            content_type = "application/zip"
        
        return StreamingResponse(
            io.BytesIO(file_data),
            media_type=content_type,
            headers={"Content-Disposition": f"inline; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.delete("/files/delete/{filename}")
async def delete_file(
    filename: str,
    current_user: User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    """Delete a file"""
    try:
        storage = StorageService()
        success = storage.delete_user_file(current_user.id, filename)
        
        if success:
            # Delete file record from database
            file_record = db.query(FileModel).filter(
                FileModel.user_id == current_user.id,
                FileModel.filename == filename
            ).first()
            if file_record:
                db.delete(file_record)
            
            # Update user storage usage
            new_usage = storage.get_user_usage(current_user.id)
            
            # Получаем пользователя из текущей сессии
            user = db.query(User).filter(User.id == current_user.id).first()
            if user:
                user.used_storage = new_usage
            db.commit()
            
            # Invalidate cached list
            try:
                CacheService().delete(f"files:list:{current_user.id}")
            except Exception:
                pass
            logger.log_file_operation(f"Файл успешно удален", current_user.id, filename, "DELETE")
            return api_ok(message="File deleted successfully")
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# OAuth endpoints
@app.get("/auth/google")
async def google_login():
    """Initiate Google OAuth login"""
    redirect_uri = "http://localhost:8000/auth/google/callback"
    authorize_url = OAuthService.get_google_authorize_url(redirect_uri)
    return RedirectResponse(url=authorize_url)

@app.get("/auth/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    """Handle Google OAuth callback"""
    try:
        # Get authorization code from query parameters
        code = request.query_params.get("code")
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Authorization code not provided"
            )
        
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": "http://localhost:8000/auth/google/callback"
                }
            )
            
            if token_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to exchange code for token"
                )
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No access token received"
                )
        
        # Get user info from Google
        user_info = await OAuthService.get_google_user_info(access_token)
        
        # Check if user already exists
        existing_user = db.query(User).filter(
            User.oauth_id == user_info.get("id"),
            User.oauth_provider == "google"
        ).first()
        
        if existing_user:
            # Update last login
            existing_user.last_login = datetime.utcnow()
            db.commit()
            user = existing_user
        else:
            # Check if user exists by email
            existing_email_user = db.query(User).filter(
                User.email == user_info.get("email")
            ).first()
            
            if existing_email_user:
                # Link OAuth to existing user
                existing_email_user.oauth_provider = "google"
                existing_email_user.oauth_id = user_info.get("id")
                existing_email_user.avatar_url = user_info.get("picture")
                existing_email_user.last_login = datetime.utcnow()
                db.commit()
                user = existing_email_user
            else:
                # Create new user
                username = user_info.get("email", "").split("@")[0]
                # Ensure username is unique
                counter = 1
                original_username = username
                while db.query(User).filter(User.username == username).first():
                    username = f"{original_username}_{counter}"
                    counter += 1
                
                user = User(
                    email=user_info.get("email"),
                    username=username,
                    full_name=user_info.get("name"),
                    oauth_provider="google",
                    oauth_id=user_info.get("id"),
                    avatar_url=user_info.get("picture"),
                    is_email_verified=True,
                    hashed_password="",  # OAuth users don't have passwords
                    is_active=True,
                    last_login=datetime.utcnow()
                )
                db.add(user)
                db.commit()
                db.refresh(user)
        
        # Create JWT token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        jwt_token = AuthService.create_access_token(
            data={"sub": str(user.id)}, expires_delta=access_token_expires
        )
        
        # Redirect to dashboard with token
        return RedirectResponse(
            url=f"/dashboard?token={jwt_token}",
            status_code=302
        )
        
    except Exception as e:
        print(f"OAuth error: {e}")
        return RedirectResponse(
            url="/login?error=oauth_failed",
            status_code=302
        )

# Health check endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check system health (flattened services + meta)."""
    data = await HealthCheckService.check_all()
    services = data.get("services") or {}
    flat = {
        "database": services.get("database"),
        "redis": services.get("redis"),
        "minio": services.get("minio"),
        "postgres": services.get("postgres"),
        "overall_status": data.get("overall_status"),
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_sec": int(time.monotonic() - APP_START_TIME),
        "version": app.version,
    }
    return HealthResponse(**flat)

@app.get("/health/database")
async def health_database():
    """Check database health"""
    return await HealthCheckService.check_database()

@app.get("/health/redis")
async def health_redis():
    """Check Redis health"""
    return await HealthCheckService.check_redis()

@app.get("/health/minio")
async def health_minio():
    """Check MinIO health"""
    return await HealthCheckService.check_minio()

@app.get("/health/postgres")
async def health_postgres():
    """Check PostgreSQL health"""
    return await HealthCheckService.check_postgres()

@app.get("/api/frag-converter/health")
async def frag_converter_health():
    try:
        node_cmd = os.environ.get("NODE_BIN", "node")
        script_path = os.path.abspath(os.path.join("TSP", "scripts", "ifc2frag.cjs"))
        # Check node availability
        try:
            ver = subprocess.run([node_cmd, "-v"], capture_output=True, text=True, timeout=10)
            node_ok = ver.returncode == 0
            node_version = ver.stdout.strip() or ver.stderr.strip()
        except Exception as e:
            node_ok = False
            node_version = str(e)
        # Check script exists and self-test
        script_exists = os.path.exists(script_path)
        selftest_ok = False
        selftest_out = None
        if script_exists and node_ok:
            st = subprocess.run([node_cmd, script_path, "--self-test"], capture_output=True, text=True, timeout=20)
            selftest_ok = st.returncode == 0
            selftest_out = st.stdout.strip() or st.stderr.strip()
        return api_ok({
            "node_ok": node_ok,
            "node_version": node_version,
            "script_exists": script_exists,
            "selftest_ok": selftest_ok,
            "selftest_out": selftest_out,
        })
    except Exception as e:
        return api_error(str(e), status=500)

# New page routes
@app.get("/files", response_class=HTMLResponse)
async def files_page(request: Request):
    """Files management page with auth and redirect to login if missing."""
    current_user = _get_user_from_request(request)
    if not current_user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse("files.html", {"request": request, "user": current_user})

@app.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request):
    """Settings page; require login, redirect if missing."""
    current_user = _get_user_from_request(request)
    if not current_user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse("settings.html", {"request": request, "user": current_user})

@app.get("/help", response_class=HTMLResponse)
async def help_page(request: Request):
    """Help page; require login, redirect if missing."""
    current_user = _get_user_from_request(request)
    if not current_user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse("help.html", {"request": request, "user": current_user})

@app.get("/admin/users", response_class=HTMLResponse)
async def admin_users_page(request: Request):
    """Admin users management page; require admin, redirect to login if missing."""
    current_user = _get_user_from_request(request)
    if not current_user or not getattr(current_user, "is_admin", False):
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse("admin-users.html", {"request": request, "user": current_user})

@app.get("/admin/system", response_class=HTMLResponse)
async def admin_system_page(request: Request):
    """Admin system status page; require admin, redirect if missing."""
    current_user = _get_user_from_request(request)
    if not current_user or not getattr(current_user, "is_admin", False):
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse("admin-system.html", {"request": request, "user": current_user})

# Include mock files router
app.include_router(mock_files_router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
