from io import BytesIO
from typing import List, Optional

from app.storage import MinIOClient


class StorageService:
    """Thin service layer over MinIOClient to decouple routes from SDK calls."""

    def __init__(self) -> None:
        self._client = MinIOClient()

    def list_user_files(self, user_id: int) -> List[dict]:
        return self._client.get_user_files(user_id)

    def get_user_usage(self, user_id: int) -> int:
        return self._client.get_user_storage_usage(user_id)

    def upload_user_file(self, user_id: int, filename: str, data: BytesIO, content_type: Optional[str]) -> bool:
        return self._client.upload_user_file(user_id, filename, data, content_type)

    def download_user_file(self, user_id: int, filename: str) -> Optional[bytes]:
        return self._client.download_file(f"user_{user_id}/{filename}")

    def delete_user_file(self, user_id: int, filename: str) -> bool:
        return self._client.delete_user_file(user_id, filename)



