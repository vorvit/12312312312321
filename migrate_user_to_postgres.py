#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import sqlite3
from app.database.connection import SessionLocal
from app.models.user import User
from passlib.context import CryptContext

# Настройка хеширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def migrate_user():
    print("Migrating user from SQLite to PostgreSQL...")
    
    # Подключение к SQLite
    sqlite_conn = sqlite3.connect('auth.db')
    sqlite_cursor = sqlite_conn.cursor()
    
    # Получаем пользователя из SQLite
    sqlite_cursor.execute('SELECT * FROM users WHERE email = ?', ('vorvit@bk.ru',))
    user_data = sqlite_cursor.fetchone()
    
    if not user_data:
        print("❌ User vorvit@bk.ru not found in SQLite")
        return False
    
    print(f"✅ Found user in SQLite: {user_data[1]}")  # email
    
    # Подключение к PostgreSQL
    db = SessionLocal()
    
    try:
        # Проверяем, есть ли уже такой пользователь в PostgreSQL
        existing_user = db.query(User).filter(User.email == 'vorvit@bk.ru').first()
        if existing_user:
            print("❌ User already exists in PostgreSQL")
            return False
        
        # Создаем нового пользователя в PostgreSQL
        new_user = User(
            email=user_data[1],  # email
            username=user_data[2],  # username
            hashed_password=user_data[3],  # hashed_password
            is_active=bool(user_data[4]),  # is_active
            is_admin=bool(user_data[5]),  # is_admin
            full_name=user_data[6] if user_data[6] else None,  # full_name
            storage_quota=user_data[9] if user_data[9] else 1073741824,  # storage_quota
            used_storage=user_data[10] if user_data[10] else 0,  # used_storage
            is_email_verified=bool(user_data[12]) if len(user_data) > 12 else False,  # is_email_verified
            oauth_provider=user_data[14] if len(user_data) > 14 and user_data[14] else None,  # oauth_provider
            oauth_id=user_data[15] if len(user_data) > 15 and user_data[15] else None,  # oauth_id
        )
        
        db.add(new_user)
        db.commit()
        
        print("✅ User migrated successfully to PostgreSQL")
        
        # Проверяем, что пользователь создался
        created_user = db.query(User).filter(User.email == 'vorvit@bk.ru').first()
        if created_user:
            print(f"✅ Verification: {created_user.email} (admin: {created_user.is_admin})")
            return True
        else:
            print("❌ User not found after migration")
            return False
            
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        db.rollback()
        return False
    finally:
        db.close()
        sqlite_conn.close()

if __name__ == "__main__":
    migrate_user()
