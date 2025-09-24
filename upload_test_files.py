#!/usr/bin/env python3
"""
Script to upload test files to MinIO and database
"""
import os
import psycopg2
from io import BytesIO
from app.storage.minio_client import MinIOClient

def upload_test_files():
    """Upload test files to MinIO and database"""
    try:
        # Connect to PostgreSQL
        conn = psycopg2.connect(
            host="localhost",
            port="5433",
            database="auth_db",
            user="auth_user",
            password="auth_password"
        )
        cursor = conn.cursor()
        
        # Get user ID
        cursor.execute("SELECT id FROM users WHERE email = %s", ("vorvit@bk.ru",))
        user_result = cursor.fetchone()
        if not user_result:
            print("❌ User not found")
            return
        
        user_id = user_result[0]
        print(f"✅ Found user ID: {user_id}")
        
        # Initialize MinIO client
        minio_client = MinIOClient()
        
        # Create test IFC files
        test_files = [
            {
                "filename": "Test_Building_01.ifc",
                "content": "IFC file content for Test_Building_01.ifc",
                "content_type": "application/octet-stream"
            },
            {
                "filename": "Test_Building_02.ifc", 
                "content": "IFC file content for Test_Building_02.ifc",
                "content_type": "application/octet-stream"
            },
            {
                "filename": "Test_Building_03.ifc",
                "content": "IFC file content for Test_Building_03.ifc", 
                "content_type": "application/octet-stream"
            }
        ]
        
        for file_data in test_files:
            filename = file_data["filename"]
            content = file_data["content"]
            content_type = file_data["content_type"]
            
            # Upload to MinIO
            file_bytes = BytesIO(content.encode())
            
            success = minio_client.upload_user_file(user_id, filename, file_bytes, content_type)
            if success:
                print(f"✅ Uploaded {filename} to MinIO")
                
                # Insert into database
                cursor.execute("""
                    INSERT INTO files (user_id, filename, original_filename, file_size, content_type, storage_path, is_public)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    user_id,
                    filename,
                    filename,
                    len(content),
                    content_type,
                    f"user_{user_id}/{filename}",
                    False
                ))
                print(f"✅ Added {filename} to database")
            else:
                print(f"❌ Failed to upload {filename}")
        
        conn.commit()
        print("✅ All test files uploaded successfully!")
        
        # Check files in database
        cursor.execute("SELECT filename, file_size FROM files WHERE user_id = %s", (user_id,))
        files = cursor.fetchall()
        print(f"✅ Files in database: {files}")
        
    except Exception as e:
        print(f"❌ Error uploading test files: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    print("Uploading test files...")
    upload_test_files()
