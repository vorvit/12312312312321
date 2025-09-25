#!/usr/bin/env python3
"""
Скрипт запуска без Docker (только Auth Service и TSP Viewer)
Используется когда Docker недоступен
"""

import subprocess
import sys
import os
import signal
import time
from pathlib import Path

class NoDockerServiceManager:
    def __init__(self):
        self.processes = []
        self.running = True
        
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
    
    def start_auth_service(self):
        """Запуск Auth Service (FastAPI)"""
        print("🔐 Запуск Auth Service...")
        
        try:
            # Запускаем FastAPI сервер
            process = subprocess.Popen([
                sys.executable, 'start.py'
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            
            self.processes.append(('Auth Service', process))
            print("✅ Auth Service запущен на http://localhost:8000")
            return True
            
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
            print("✅ TSP Viewer запущен на http://localhost:5174")
            return True
            
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
    
    def run(self):
        """Основной метод запуска"""
        print("🚀 Запуск IFC Auth System (без Docker)")
        print("⚠️  ВНИМАНИЕ: Некоторые функции могут не работать без Docker сервисов")
        print("=" * 60)
        
        # Устанавливаем обработчик сигналов
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        # Проверяем зависимости
        if not self.check_dependencies():
            print("❌ Не все зависимости установлены")
            return False
        
        # Запускаем Auth Service
        if not self.start_auth_service():
            print("❌ Не удалось запустить Auth Service")
            return False
        
        # Небольшая пауза между запусками
        time.sleep(2)
        
        # Запускаем TSP Viewer
        if not self.start_viewer_service():
            print("❌ Не удалось запустить TSP Viewer")
            return False
        
        print("\n" + "=" * 60)
        print("🎉 Основные сервисы запущены!")
        print("\n📋 Доступные сервисы:")
        print("   🔐 Auth Service: http://localhost:8000")
        print("   🎨 TSP Viewer: http://localhost:5174")
        print("\n⚠️  Отсутствуют Docker сервисы:")
        print("   🗄️  PostgreSQL (база данных)")
        print("   🔄 Redis (кэш)")
        print("   📦 MinIO (файловое хранилище)")
        print("\n💡 Для полной функциональности запустите: python start_all_services.py")
        print("💡 Для остановки нажмите Ctrl+C")
        print("=" * 60)
        
        # Ждем завершения
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.signal_handler(signal.SIGINT, None)

def main():
    """Главная функция"""
    manager = NoDockerServiceManager()
    try:
        manager.run()
    except KeyboardInterrupt:
        print("\n👋 Завершение работы...")
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")
        manager.stop_all_services()

if __name__ == "__main__":
    main()
