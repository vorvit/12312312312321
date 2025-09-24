#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from passlib.context import CryptContext
import sqlite3

# Настройка хеширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def test_direct_auth():
    # Подключение к базе данных
    conn = sqlite3.connect('auth.db')
    cursor = conn.cursor()
    
    # Получение пользователя
    cursor.execute('SELECT id, email, hashed_password, is_admin, is_active FROM users WHERE email = ?', ('vorvit@bk.ru',))
    user = cursor.fetchone()
    
    if not user:
        print("❌ Пользователь не найден")
        return False
    
    user_id, email, hashed_password, is_admin, is_active = user
    print(f"✅ Пользователь найден:")
    print(f"   ID: {user_id}")
    print(f"   Email: {email}")
    print(f"   is_admin: {is_admin}")
    print(f"   is_active: {is_active}")
    print(f"   password hash: {hashed_password[:50]}...")
    
    # Тестирование пароля
    test_password = "123qwerty"
    print(f"\n🔐 Тестирование пароля: {test_password}")
    
    password_valid = pwd_context.verify(test_password, hashed_password)
    print(f"   Результат проверки: {password_valid}")
    
    if password_valid:
        print("✅ Пароль правильный!")
        print("✅ Пользователь активен!")
        print("✅ Пользователь является администратором!")
        return True
    else:
        print("❌ Пароль неправильный!")
        return False

if __name__ == "__main__":
    test_direct_auth()
