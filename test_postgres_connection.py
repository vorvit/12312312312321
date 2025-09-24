#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import engine, SessionLocal
from app.models.user import User
from app.database.base import Base

print("Testing PostgreSQL connection...")

try:
    # Создаем все таблицы
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created/verified in PostgreSQL")
    
    # Создаем сессию
    db = SessionLocal()
    print("✅ PostgreSQL session created")
    
    # Проверяем количество пользователей
    count = db.query(User).count()
    print(f"Total users in PostgreSQL: {count}")
    
    # Выведем всех пользователей
    users = db.query(User).all()
    for u in users:
        print(f"  - {u.email} (admin: {u.is_admin})")
    
    # Проверим конкретного пользователя
    user = db.query(User).filter(User.email == 'vorvit@bk.ru').first()
    if user:
        print(f"✅ User vorvit@bk.ru found: admin={user.is_admin}, active={user.is_active}")
    else:
        print("❌ User vorvit@bk.ru not found in PostgreSQL")
    
    db.close()
    print("✅ PostgreSQL session closed")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
