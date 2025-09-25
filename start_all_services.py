#!/usr/bin/env python3
"""
Комплексный скрипт запуска всех сервисов IFC Auth System
Запускает все необходимые сервисы в правильной последовательности
"""

import subprocess
import sys
import time
import os
import signal
import threading
from pathlib import Path

class ServiceManager:
    def __init__(self):
        self.processes = []
        self.running = True
        
    def start_docker_services(self):
        """Запуск Docker сервисов (PostgreSQL, Redis, MinIO)"""
        print("🐳 Запуск Docker сервисов...")
        
        try:
            # Проверяем, что Docker запущен
            result = subprocess.run(['docker', '--version'], capture_output=True, text=True)
            if result.returncode != 0:
                print("❌ Docker не найден. Установите Docker Desktop.")
                return False
            
            # Проверяем версию Docker Compose
            compose_result = subprocess.run(['docker-compose', '--version'], capture_output=True, text=True)
            if compose_result.returncode != 0:
                print("❌ Docker Compose не найден. Установите Docker Desktop.")
                return False
                
            # Запускаем сервисы
            result = subprocess.run([
                'docker-compose', 'up', '-d'
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                print("✅ Docker сервисы запущены успешно!")
                print("   - PostgreSQL: localhost:5433")
                print("   - Redis: localhost:6380") 
                print("   - MinIO: localhost:9000 (Console: localhost:9001)")
                return True
            else:
                print(f"❌ Ошибка запуска Docker сервисов: {result.stderr}")
                return False
                
        except FileNotFoundError:
            print("❌ Docker Compose не найден. Установите Docker Desktop.")
            return False
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            return False
    
    def wait_for_services(self):
        """Ожидание готовности сервисов"""
        print("⏳ Ожидание готовности Docker сервисов...")
        
        # Проверяем готовность каждого сервиса
        services = [
            ('PostgreSQL', 'localhost', 5433),
            ('Redis', 'localhost', 6380),
            ('MinIO', 'localhost', 9000)
        ]
        
        for service_name, host, port in services:
            print(f"   ⏳ Ожидание {service_name}...")
            if self.wait_for_port(host, port, timeout=30):
                print(f"   ✅ {service_name} готов")
            else:
                print(f"   ❌ {service_name} не отвечает")
                return False
        
        print("✅ Все Docker сервисы готовы")
        return True
    
    def wait_for_port(self, host, port, timeout=30):
        """Ожидание готовности порта"""
        import socket
        
        for attempt in range(timeout):
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex((host, port))
                sock.close()
                
                if result == 0:
                    return True
            except:
                pass
            
            time.sleep(1)
        
        return False
    
    def start_auth_service(self):
        """Запуск Auth Service (FastAPI)"""
        print("🔐 Запуск Auth Service...")
        
        try:
            # Запускаем FastAPI сервер
            process = subprocess.Popen([
                sys.executable, 'start.py'
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            
            self.processes.append(('Auth Service', process))
            
            # Даем время процессу запуститься
            time.sleep(3)
            
            # Ждем готовности Auth Service (больше времени для инициализации БД)
            print("   ⏳ Ожидание готовности Auth Service...")
            if self.wait_for_service('http://localhost:8000', 'Auth Service', timeout=60):
                print("✅ Auth Service готов на http://localhost:8000")
                return True
            else:
                print("❌ Auth Service не отвечает (timeout 60s)")
                return False
            
        except Exception as e:
            print(f"❌ Ошибка запуска Auth Service: {e}")
            return False
    
    def start_viewer_service(self):
        """Запуск TSP Viewer (Vite)"""
        print("🎨 Запуск TSP Viewer...")
        
        try:
            # Переходим в директорию TSP
            tsp_dir = Path('TSP')
            if not tsp_dir.exists():
                print("❌ Директория TSP не найдена")
                return False
            
            # Определяем команду npm в зависимости от ОС
            npm_cmd = self.get_npm_command()
            if not npm_cmd:
                return False
                
            # Запускаем Vite сервер
            process = subprocess.Popen([
                npm_cmd, 'run', 'dev'
            ], cwd=tsp_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            
            self.processes.append(('TSP Viewer', process))
            
            # Ждем готовности TSP Viewer
            print("   ⏳ Ожидание готовности TSP Viewer...")
            if self.wait_for_service('http://localhost:5174', 'TSP Viewer'):
                print("✅ TSP Viewer готов на http://localhost:5174")
                return True
            else:
                print("❌ TSP Viewer не отвечает")
                return False
            
        except Exception as e:
            print(f"❌ Ошибка запуска TSP Viewer: {e}")
            return False
    
    def get_npm_command(self):
        """Получение правильной команды npm для текущей ОС"""
        import platform
        
        # Список возможных команд npm
        npm_commands = [
            'npm',
            'npm.cmd',  # Windows
            'npx',
            'npx.cmd'   # Windows
        ]
        
        # Проверяем каждую команду
        for cmd in npm_commands:
            try:
                result = subprocess.run([cmd, '--version'], 
                                      capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    print(f"✅ Найден npm: {cmd}")
                    return cmd
            except (FileNotFoundError, subprocess.TimeoutExpired):
                continue
        
        # Если ничего не найдено, пробуем через shell
        if platform.system() == "Windows":
            try:
                # Пробуем через cmd
                result = subprocess.run(['cmd', '/c', 'npm', '--version'], 
                                      capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    print("✅ Найден npm через cmd")
                    return ['cmd', '/c', 'npm']
            except (FileNotFoundError, subprocess.TimeoutExpired):
                pass
        
        print("❌ npm не найден. Установите Node.js")
        print("   Скачайте с: https://nodejs.org/")
        return None
    
    def wait_for_service(self, url, service_name, timeout=30):
        """Ожидание готовности сервиса"""
        import requests
        import socket
        
        # Извлекаем порт из URL
        port = url.split(':')[-1].split('/')[0]
        
        for attempt in range(timeout):
            try:
                # Сначала проверяем, слушает ли порт
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex(('localhost', int(port)))
                sock.close()
                
                if result == 0:
                    # Порт слушается, пробуем HTTP запрос
                    response = requests.get(url, timeout=2)
                    if response.status_code == 200:
                        return True
            except (requests.exceptions.RequestException, socket.error, ValueError):
                pass
            
            time.sleep(1)
            if attempt % 5 == 0 and attempt > 0:
                print(f"   ⏳ {service_name} еще не готов... ({attempt}s)")
        
        return False
    
    def check_dependencies(self):
        """Проверка зависимостей"""
        print("🔍 Проверка зависимостей...")
        
        # Проверяем Python пакеты
        try:
            import fastapi
            import uvicorn
            import sqlalchemy
            print("✅ Python зависимости установлены")
        except ImportError as e:
            print(f"❌ Отсутствуют Python зависимости: {e}")
            print("   Установите: pip install -r requirements.txt")
            return False
        
        # Проверяем Node.js
        try:
            result = subprocess.run(['node', '--version'], capture_output=True, text=True)
            if result.returncode == 0:
                print("✅ Node.js установлен")
            else:
                print("❌ Node.js не найден")
                return False
        except FileNotFoundError:
            print("❌ Node.js не найден")
            return False
        
        # Проверяем npm
        npm_cmd = self.get_npm_command()
        if not npm_cmd:
            return False
        
        # Проверяем npm пакеты в TSP
        tsp_dir = Path('TSP')
        if tsp_dir.exists():
            node_modules = tsp_dir / 'node_modules'
            if not node_modules.exists():
                print("❌ npm пакеты не установлены в TSP")
                print("   Выполните: cd TSP && npm install")
                return False
            else:
                print("✅ npm пакеты установлены")
        
        return True
    
    def signal_handler(self, signum, frame):
        """Обработчик сигналов для корректного завершения"""
        print("\n🛑 Получен сигнал завершения...")
        self.running = False
        self.stop_all_services()
        sys.exit(0)
    
    def stop_all_services(self):
        """Остановка всех сервисов"""
        print("🛑 Остановка всех сервисов...")
        
        for name, process in self.processes:
            try:
                print(f"   Остановка {name}...")
                process.terminate()
                process.wait(timeout=5)
                print(f"   ✅ {name} остановлен")
            except subprocess.TimeoutExpired:
                print(f"   ⚠️  Принудительная остановка {name}...")
                process.kill()
            except Exception as e:
                print(f"   ❌ Ошибка остановки {name}: {e}")
        
        # Останавливаем Docker сервисы
        try:
            subprocess.run(['docker-compose', 'down'], capture_output=True)
            print("✅ Docker сервисы остановлены")
        except Exception as e:
            print(f"⚠️  Ошибка остановки Docker: {e}")
    
    def run(self):
        """Основной метод запуска"""
        print("🚀 Запуск IFC Auth System")
        print("=" * 50)
        
        # Устанавливаем обработчик сигналов
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        # Проверяем зависимости
        if not self.check_dependencies():
            print("❌ Не все зависимости установлены")
            return False
        
        # Запускаем Docker сервисы
        if not self.start_docker_services():
            print("❌ Не удалось запустить Docker сервисы")
            return False
        
        # Ждем готовности сервисов
        if not self.wait_for_services():
            print("❌ Не все Docker сервисы готовы")
            return False
        
        # Запускаем Auth Service
        if not self.start_auth_service():
            print("❌ Не удалось запустить Auth Service")
            return False
        
        # Запускаем TSP Viewer
        if not self.start_viewer_service():
            print("❌ Не удалось запустить TSP Viewer")
            return False
        
        print("\n" + "=" * 50)
        print("🎉 Все сервисы запущены успешно!")
        print("\n📋 Доступные сервисы:")
        print("   🔐 Auth Service: http://localhost:8000")
        print("   🎨 TSP Viewer: http://localhost:5174")
        print("   🗄️  PostgreSQL: localhost:5433")
        print("   🔄 Redis: localhost:6380")
        print("   📦 MinIO: localhost:9000")
        print("\n💡 Для остановки нажмите Ctrl+C")
        print("=" * 50)
        
        # Ждем завершения
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.signal_handler(signal.SIGINT, None)

def main():
    """Главная функция"""
    manager = ServiceManager()
    try:
        manager.run()
    except KeyboardInterrupt:
        print("\n👋 Завершение работы...")
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")
        manager.stop_all_services()

if __name__ == "__main__":
    main()
