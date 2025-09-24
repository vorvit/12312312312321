#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from passlib.context import CryptContext
import sqlite3

# Настройка хеширования паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def test_authentication():
    # Подключение к базе данных
    conn = sqlite3.connect('auth.db')
    cursor = conn.cursor()
    
    # Получение пользователя
    cursor.execute('SELECT email, hashed_password, is_admin, is_active FROM users WHERE email = ?', ('vorvit@bk.ru',))
    user = cursor.fetchone()
    
    if not user:
        print("❌ Пользователь не найден")
        return False
    
    email, hashed_password, is_admin, is_active = user
    print(f"✅ Пользователь найден: {email}")
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
        return True
    else:
        print("❌ Пароль неправильный!")
        
        # Попробуем другие варианты паролей
        common_passwords = ["123456", "password", "admin", "qwerty", "123qwerty", "vorvit"]
        print("\n🔍 Проверяем другие возможные пароли:")
        for pwd in common_passwords:
            if pwd_context.verify(pwd, hashed_password):
                print(f"✅ Найден правильный пароль: {pwd}")
                return True
            else:
                print(f"❌ {pwd}")
        
        return False

if __name__ == "__main__":
    test_authentication()
