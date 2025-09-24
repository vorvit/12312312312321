#!/usr/bin/env python3
"""
Script to update user password
"""
import sqlite3
import hashlib
import secrets

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
            
            # Create new password hash
            password = "password123"
            salt = secrets.token_hex(16)
            password_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
            hashed_password = f"pbkdf2_sha256$100000${salt}${password_hash.hex()}"
            
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
    print("Updating user password...")
    update_password()
