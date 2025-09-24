import time
from typing import Optional

from fastapi import Request, HTTPException, status

try:
    from app.cache import redis_client
except Exception:
    redis_client = None  # type: ignore


class LoginRateLimiter:
    def __init__(self, max_attempts: int, window_sec: int) -> None:
        self.max_attempts = max_attempts
        self.window_sec = window_sec
        self._mem = {}

    def _key(self, ip: str, email: Optional[str]) -> str:
        return f"login:{ip}:{(email or '').lower()}"

    def check(self, request: Request, email: Optional[str]) -> None:
        ip = request.client.host if request.client else "unknown"
        key = self._key(ip, email)

        # Prefer Redis if connected
        try:
            if redis_client and redis_client.is_connected():
                now = int(time.time())
                pipe = redis_client.client.pipeline()  # type: ignore[attr-defined]
                pipe.zremrangebyscore(key, 0, now - self.window_sec)
                pipe.zadd(key, {str(now): now})
                pipe.zcard(key)
                pipe.expire(key, self.window_sec)
                _, _, count, _ = pipe.execute()
                if int(count) > self.max_attempts:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Too many login attempts. Try again later."
                    )
                return
        except Exception:
            # Fallback to memory
            pass

        # In-memory fallback
        now = time.time()
        bucket = self._mem.setdefault(key, [])
        # drop old
        cutoff = now - self.window_sec
        bucket[:] = [t for t in bucket if t > cutoff]
        bucket.append(now)
        if len(bucket) > self.max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Try again later."
            )



