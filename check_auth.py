#!/usr/bin/env python3
"""
Скрипт для проверки состояния Auth Service
"""

import requests
import socket
import time

def check_port(port):
    """Проверка, слушает ли порт"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(('localhost', port))
        sock.close()
        return result == 0
    except:
        return False

def check_http(url):
    """Проверка HTTP ответа"""
    try:
        response = requests.get(url, timeout=2)
        return response.status_code == 200
    except:
        return False

def main():
    print("🔍 Проверка Auth Service...")
    
    # Проверяем порт
    if check_port(8000):
        print("✅ Порт 8000 слушается")
        
        # Проверяем HTTP
        if check_http('http://localhost:8000'):
            print("✅ HTTP ответ получен")
            print("✅ Auth Service работает!")
            
            # Проверяем конкретные маршруты
            routes = [
                '/login',
                '/register', 
                '/dashboard',
                '/docs'
            ]
            
            print("\n📋 Проверка маршрутов:")
            for route in routes:
                url = f'http://localhost:8000{route}'
                if check_http(url):
                    print(f"   ✅ {route}")
                else:
                    print(f"   ❌ {route}")
        else:
            print("❌ HTTP не отвечает")
    else:
        print("❌ Порт 8000 не слушается")
        print("   Возможно, Auth Service не запущен")

if __name__ == "__main__":
    main()
