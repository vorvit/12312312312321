#!/usr/bin/env python3
"""
Script to create a new user
"""
import sqlite3
from passlib.context import CryptContext

def create_new_user():
    """Create a new user"""
    conn = sqlite3.connect('auth.db')
    cursor = conn.cursor()
    
    try:
        # Create new password hash with bcrypt
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        password = "password123"
        hashed_password = pwd_context.hash(password)
        
        # Create new user
        cursor.execute("""
            INSERT INTO users (email, username, hashed_password, full_name, is_admin, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        """, ("newuser@test.com", "newuser", hashed_password, "New User", True, True))
        
        conn.commit()
        
        print("✅ New user created successfully!")
        print(f"   Email: newuser@test.com")
        print(f"   Password: {password}")
        
    except Exception as e:
        print(f"❌ Error creating user: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("Creating new user...")
    create_new_user()
