#!/usr/bin/env python3
"""
Script to create files table in PostgreSQL
"""
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def create_files_table():
    """Create files table in PostgreSQL"""
    try:
        # Connect to PostgreSQL
        conn = psycopg2.connect(
            host="localhost",
            port="5433",
            database="auth_db",
            user="auth_user",
            password="auth_password"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Create files table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                filename VARCHAR(255) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                file_size INTEGER NOT NULL,
                content_type VARCHAR(100),
                storage_path VARCHAR(500) NOT NULL,
                is_public BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        
        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);")
        
        print("✅ Files table created successfully!")
        
        # Check if table exists
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'files'
        """)
        result = cursor.fetchone()
        if result:
            print("✅ Files table exists in database")
        else:
            print("❌ Files table not found")
            
    except Exception as e:
        print(f"❌ Error creating files table: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    print("Creating files table...")
    create_files_table()
