#!/usr/bin/env python3
"""
Script to update user password with bcrypt
"""
import sqlite3
from passlib.context import CryptContext

def update_password():
    """Update user password"""
    conn = sqlite3.connect('auth.db')
    cursor = conn.cursor()
    
    try:
        # Get user
        cursor.execute("SELECT id, email FROM users WHERE email = ?", ("vorvit@bk.ru",))
        user = cursor.fetchone()
        
        if user:
            user_id, email = user
            print(f"Found user: {email}")
            
            # Create new password hash with bcrypt
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            password = "password123"
            hashed_password = pwd_context.hash(password)
            
            # Update password
            cursor.execute("UPDATE users SET hashed_password = ? WHERE id = ?", (hashed_password, user_id))
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
    print("Updating user password with bcrypt...")
    update_password()
