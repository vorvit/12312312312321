#!/usr/bin/env python3
"""
Simple startup script for the IFC Auth Service
Запускает только Auth Service на порту 8000
"""

import uvicorn
import sys
import os
from pathlib import Path

# Добавляем текущую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from config import settings
    DEBUG = settings.DEBUG
except ImportError:
    DEBUG = True

if __name__ == "__main__":
    print("🔐 Запуск IFC Auth Service...")
    print("   Порт: 8000")
    print("   Режим отладки:", DEBUG)
    print("   URL: http://localhost:8000")
    print("   Для остановки нажмите Ctrl+C")
    print("-" * 40)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=DEBUG,
        log_level="info"
    )

