#!/usr/bin/env python3
"""
Скрипт для запуска упрощенного viewer
Обходит сложную логику аутентификации и предзагрузки
"""

import subprocess
import sys
import os
import time
import webbrowser
from pathlib import Path

def main():
    print("🚀 Запуск упрощенного IFC Viewer")
    print("=" * 50)
    
    # Проверяем, что мы в правильной директории
    if not os.path.exists("TSP"):
        print("❌ Директория TSP не найдена")
        return 1
    
    # Переходим в директорию TSP
    os.chdir("TSP")
    
    # Проверяем, что node_modules существует
    if not os.path.exists("node_modules"):
        print("❌ node_modules не найдена. Запустите npm install")
        return 1
    
    print("✅ Запуск Vite сервера...")
    
    try:
        # Запускаем Vite сервер
        process = subprocess.Popen(
            ["npm", "run", "dev"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Ждем, пока сервер запустится
        print("⏳ Ожидание запуска сервера...")
        time.sleep(3)
        
        # Проверяем, что процесс запущен
        if process.poll() is None:
            print("✅ Vite сервер запущен успешно!")
            print("🌐 Откройте: http://localhost:5174/simple-viewer.html")
            print("📝 Или используйте URL с токеном:")
            print("   http://localhost:5174/simple-viewer.html?token=YOUR_TOKEN")
            print("\n💡 Упрощенный viewer обходит сложную аутентификацию")
            print("   и загружает файлы напрямую через mock API")
            
            # Открываем браузер
            try:
                webbrowser.open("http://localhost:5174/simple-viewer.html")
            except:
                pass
            
            print("\n🔄 Нажмите Ctrl+C для остановки")
            
            # Ждем завершения процесса
            try:
                process.wait()
            except KeyboardInterrupt:
                print("\n🛑 Остановка сервера...")
                process.terminate()
                process.wait()
                print("✅ Сервер остановлен")
        else:
            stdout, stderr = process.communicate()
            print(f"❌ Ошибка запуска сервера:")
            print(f"STDOUT: {stdout}")
            print(f"STDERR: {stderr}")
            return 1
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
