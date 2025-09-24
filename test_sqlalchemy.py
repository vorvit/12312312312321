#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import engine, SessionLocal
from app.models.user import User

# Тестируем подключение к базе данных
print("Testing SQLAlchemy connection...")

try:
    # Создаем сессию
    db = SessionLocal()
    print("✅ Database session created")
    
    # Пробуем найти пользователя
    user = db.query(User).filter(User.email == 'vorvit@bk.ru').first()
    if user:
        print(f"✅ User found: {user.email}, is_admin: {user.is_admin}")
    else:
        print("❌ User not found")
        
        # Проверим, сколько пользователей в базе
        count = db.query(User).count()
        print(f"Total users in database: {count}")
        
        # Выведем всех пользователей
        users = db.query(User).all()
        for u in users:
            print(f"  - {u.email} (admin: {u.is_admin})")
    
    db.close()
    print("✅ Database session closed")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
