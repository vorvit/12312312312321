import asyncio
import httpx
from sqlalchemy import text
from app.database import engine
from app.cache import redis_client
from app.storage import MinIOClient
from config import settings
import logging

logger = logging.getLogger(__name__)

class HealthCheckService:
    @staticmethod
    async def check_database() -> dict:
        """Check database connection"""
        try:
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1"))
                result.fetchone()
                return {
                    "status": "healthy",
                    "type": "SQLite" if "sqlite" in settings.DATABASE_URL else "PostgreSQL",
                    "url": settings.DATABASE_URL
                }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "type": "Database"
            }

    @staticmethod
    async def check_redis() -> dict:
        """Check Redis connection"""
        try:
            if redis_client.is_connected():
                # Test set/get
                test_key = "health_check_test"
                redis_client.set(test_key, "test_value", expire=10)
                value = redis_client.get(test_key)
                redis_client.delete(test_key)
                
                if value == "test_value":
                    return {
                        "status": "healthy",
                        "host": f"{settings.REDIS_HOST}:{settings.REDIS_PORT}",
                        "db": settings.REDIS_DB
                    }
                else:
                    return {
                        "status": "unhealthy",
                        "error": "Redis test failed"
                    }
            else:
                return {
                    "status": "unhealthy",
                    "error": "Redis not connected"
                }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "host": f"{settings.REDIS_HOST}:{settings.REDIS_PORT}"
            }

    @staticmethod
    async def check_minio() -> dict:
        """Check MinIO connection"""
        try:
            minio_client = MinIOClient()
            # Try to list buckets
            buckets = minio_client.client.list_buckets()
            return {
                "status": "healthy",
                "endpoint": settings.MINIO_ENDPOINT,
                "buckets": len(buckets),
                "bucket_name": settings.MINIO_BUCKET_NAME
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "endpoint": settings.MINIO_ENDPOINT
            }

    @staticmethod
    async def check_postgres() -> dict:
        """Check PostgreSQL connection (if configured)"""
        try:
            if "postgresql" in settings.DATABASE_URL:
                # Already checked in database check
                return {
                    "status": "healthy",
                    "type": "PostgreSQL",
                    "url": settings.DATABASE_URL
                }
            else:
                # Try to connect to PostgreSQL directly using psycopg2
                import psycopg2
                conn = psycopg2.connect(
                    host=settings.POSTGRES_HOST,
                    port=settings.POSTGRES_PORT,
                    database=settings.POSTGRES_DB,
                    user=settings.POSTGRES_USER,
                    password=settings.POSTGRES_PASSWORD,
                    client_encoding='utf8',
                    connect_timeout=2
                )
                conn.close()
                
                return {
                    "status": "healthy",
                    "type": "PostgreSQL",
                    "host": f"{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}",
                    "database": settings.POSTGRES_DB
                }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "type": "PostgreSQL"
            }

    @staticmethod
    async def check_all() -> dict:
        """Check all services"""
        results = {
            "database": await HealthCheckService.check_database(),
            "redis": await HealthCheckService.check_redis(),
            "minio": await HealthCheckService.check_minio(),
            "postgres": await HealthCheckService.check_postgres()
        }
        
        # Overall status
        all_healthy = all(
            result["status"] == "healthy" 
            for result in results.values()
        )
        
        return {
            "overall_status": "healthy" if all_healthy else "degraded",
            "services": results,
            "timestamp": asyncio.get_event_loop().time()
        }
