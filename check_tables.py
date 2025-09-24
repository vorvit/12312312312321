#!/usr/bin/env python3

import sqlite3

conn = sqlite3.connect('auth.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print('Tables in database:', [table[0] for table in tables])

# Проверим структуру таблицы users
cursor.execute("PRAGMA table_info(users)")
columns = cursor.fetchall()
print('\nUsers table columns:')
for col in columns:
    print(f"  {col[1]} ({col[2]})")

conn.close()
