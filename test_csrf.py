#!/usr/bin/env python3

import requests
import json

# Получаем CSRF токен
response = requests.get("http://localhost:8000/login")
csrf_token = None
for cookie in response.cookies:
    if cookie.name == 'csrf_token':
        csrf_token = cookie.value
        break

print(f"CSRF Token: {csrf_token}")

if csrf_token:
    # Пробуем войти с CSRF токеном
    headers = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf_token
    }
    
    data = {
        'email': 'vorvit@bk.ru',
        'password': '123qwerty'
    }
    
    response = requests.post(
        "http://localhost:8000/auth/login",
        headers=headers,
        json=data,
        cookies=response.cookies
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
else:
    print("CSRF token not found")
