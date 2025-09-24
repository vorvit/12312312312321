import json
from typing import Any, Optional

try:
    from app.cache import redis_client
except Exception:
    redis_client = None  # type: ignore


class CacheService:
    def __init__(self) -> None:
        self._client = redis_client

    def available(self) -> bool:
        try:
            return bool(self._client and self._client.is_connected())
        except Exception:
            return False

    def get(self, key: str) -> Optional[Any]:
        if not self.available():
            return None
        try:
            raw = self._client.get(key)  # type: ignore[attr-defined]
            if raw is None:
                return None
            if isinstance(raw, (dict, list)):
                return raw
            if isinstance(raw, (bytes, str)):
                return json.loads(raw if isinstance(raw, str) else raw.decode("utf-8"))
        except Exception:
            return None
        return None

    def set(self, key: str, value: Any, expire: int = 300) -> None:
        if not self.available():
            return
        try:
            payload = json.dumps(value, ensure_ascii=False)
            self._client.set(key, payload, expire=expire)  # type: ignore[attr-defined]
        except Exception:
            return

    def delete(self, key: str) -> None:
        if not self.available():
            return
        try:
            self._client.delete(key)  # type: ignore[attr-defined]
        except Exception:
            return


