#!/usr/bin/env python3
"""
Скрипт запуска TSP Viewer
Запускает только TSP Viewer на порту 5174
"""

import subprocess
import sys
import os
import signal
from pathlib import Path

class ViewerManager:
    def __init__(self):
        self.process = None
        self.running = True
        
    def signal_handler(self, signum, frame):
        """Обработчик сигналов для корректного завершения"""
        print("\n🛑 Остановка TSP Viewer...")
        self.running = False
        if self.process:
            self.process.terminate()
        sys.exit(0)
    
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
    
    def start_viewer(self):
        """Запуск TSP Viewer"""
        print("🎨 Запуск TSP Viewer...")
        
        # Проверяем директорию TSP
        tsp_dir = Path('TSP')
        if not tsp_dir.exists():
            print("❌ Директория TSP не найдена")
            return False
        
        # Проверяем node_modules
        node_modules = tsp_dir / 'node_modules'
        if not node_modules.exists():
            print("❌ npm пакеты не установлены")
            print("   Выполните: cd TSP && npm install")
            return False
        
        # Определяем команду npm
        npm_cmd = self.get_npm_command()
        if not npm_cmd:
            return False
        
        try:
            # Запускаем Vite сервер
            self.process = subprocess.Popen([
                npm_cmd, 'run', 'dev'
            ], cwd=tsp_dir)
            
            print("✅ TSP Viewer запущен на http://localhost:5174")
            print("   Для остановки нажмите Ctrl+C")
            print("-" * 40)
            
            # Ждем завершения процесса
            self.process.wait()
            return True
            
        except Exception as e:
            print(f"❌ Ошибка запуска TSP Viewer: {e}")
            return False
    
    def run(self):
        """Основной метод запуска"""
        # Устанавливаем обработчик сигналов
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        return self.start_viewer()

def main():
    """Главная функция"""
    manager = ViewerManager()
    try:
        manager.run()
    except KeyboardInterrupt:
        print("\n👋 Завершение работы...")
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")

if __name__ == "__main__":
    main()
