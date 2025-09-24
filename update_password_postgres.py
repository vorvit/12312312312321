#!/usr/bin/env python3
"""
Script to update user password in PostgreSQL
"""
import psycopg2
from passlib.context import CryptContext

def update_password():
    """Update user password in PostgreSQL"""
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
        
        # Get user
        cursor.execute("SELECT id, email FROM users WHERE email = %s", ("vorvit@bk.ru",))
        user = cursor.fetchone()
        
        if user:
            user_id, email = user
            print(f"Found user: {email}")
            
            # Create new password hash with bcrypt
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            password = "password123"
            hashed_password = pwd_context.hash(password)
            
            # Update password
            cursor.execute("UPDATE users SET hashed_password = %s WHERE id = %s", (hashed_password, user_id))
            conn.commit()
            
            print("✅ Password updated successfully!")
            print(f"   Email: {email}")
            print(f"   Password: {password}")
        else:
            print("❌ User not found")
            
    except Exception as e:
        print(f"❌ Error updating password: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("Updating user password in PostgreSQL...")
    update_password()
