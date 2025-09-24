#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import engine, SessionLocal
from app.database.base import Base
from app.models.user import User
from app.models.password_reset import PasswordResetToken

print("Testing database creation...")

try:
    # Создаем все таблицы
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created/verified")
    
    # Создаем сессию
    db = SessionLocal()
    print("✅ Database session created")
    
    # Проверяем количество пользователей
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
