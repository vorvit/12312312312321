"""
MinIO Client for file storage
"""
import os
from minio import Minio
from minio.error import S3Error
from typing import List, Dict, Optional
import io
from config import settings

class MinIOClient:
    def __init__(self):
        """Initialize MinIO client"""
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=False  # Set to True for HTTPS
        )
        self.bucket_name = settings.MINIO_BUCKET_NAME
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """Ensure the bucket exists"""
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                print(f"✅ Created bucket: {self.bucket_name}")
        except S3Error as e:
            print(f"❌ Error creating bucket: {e}")
    
    def upload_user_file(self, user_id: int, filename: str, file_data: io.BytesIO, content_type: str = "application/octet-stream") -> bool:
        """Upload a file for a user"""
        try:
            object_name = f"user_{user_id}/{filename}"
            file_data.seek(0)
            
            self.client.put_object(
                self.bucket_name,
                object_name,
                file_data,
                file_data.getbuffer().nbytes,
                content_type=content_type
            )
            print(f"✅ File uploaded: {object_name}")
            return True
        except S3Error as e:
            print(f"❌ Error uploading file: {e}")
            return False
    
    def download_file(self, object_name: str) -> Optional[bytes]:
        """Download a file"""
        try:
            response = self.client.get_object(self.bucket_name, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            print(f"❌ Error downloading file: {e}")
            return None
    
    def delete_user_file(self, user_id: int, filename: str) -> bool:
        """Delete a user's file"""
        try:
            object_name = f"user_{user_id}/{filename}"
            self.client.remove_object(self.bucket_name, object_name)
            print(f"✅ File deleted: {object_name}")
            return True
        except S3Error as e:
            print(f"❌ Error deleting file: {e}")
            return False
    
    def get_user_files(self, user_id: int) -> List[Dict]:
        """Get list of user's files"""
        try:
            prefix = f"user_{user_id}/"
            objects = self.client.list_objects(
                self.bucket_name,
                prefix=prefix,
                recursive=True
            )
            
            files = []
            for obj in objects:
                filename = obj.object_name.replace(prefix, "")
                files.append({
                    "name": filename,
                    "size": obj.size,
                    "last_modified": obj.last_modified,
                    "etag": obj.etag
                })
            
            return files
        except S3Error as e:
            print(f"❌ Error listing files: {e}")
            return []
    
    def get_user_storage_usage(self, user_id: int) -> int:
        """Get user's storage usage in bytes"""
        try:
            prefix = f"user_{user_id}/"
            objects = self.client.list_objects(
                self.bucket_name,
                prefix=prefix,
                recursive=True
            )
            
            total_size = 0
            for obj in objects:
                total_size += obj.size
            
            return total_size
        except S3Error as e:
            print(f"❌ Error calculating storage usage: {e}")
            return 0
    
    def delete_user_folder(self, user_id: int) -> bool:
        """Delete all files for a user"""
        try:
            prefix = f"user_{user_id}/"
            objects = self.client.list_objects(
                self.bucket_name,
                prefix=prefix,
                recursive=True
            )
            
            for obj in objects:
                self.client.remove_object(self.bucket_name, obj.object_name)
            
            print(f"✅ Deleted all files for user {user_id}")
            return True
        except S3Error as e:
            print(f"❌ Error deleting user folder: {e}")
            return False

