"""
Система логирования с поддержкой кириллицы
"""
import logging
from logging.handlers import TimedRotatingFileHandler
import os
from datetime import datetime
from typing import List, Dict

class CyrillicLogger:
    def __init__(self):
        """Инициализация системы логирования"""
        self.log_dir = "logs"
        self.ensure_log_dir()
        self.setup_loggers()
    
    def ensure_log_dir(self):
        """Создание директории для логов"""
        if not os.path.exists(self.log_dir):
            os.makedirs(self.log_dir)
    
    def setup_loggers(self):
        """Настройка логгеров"""
        # Форматтер с кириллицей
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # Основной логгер
        self.main_logger = logging.getLogger('main_app')
        self.main_logger.setLevel(logging.INFO)
        self.main_logger.handlers.clear()
        main_handler = TimedRotatingFileHandler(
            os.path.join(self.log_dir, 'main.log'), when='midnight', backupCount=14, encoding='utf-8'
        )
        main_handler.setFormatter(formatter)
        self.main_logger.addHandler(main_handler)
        
        # Логгер для аутентификации
        self.auth_logger = logging.getLogger('auth_events')
        self.auth_logger.setLevel(logging.INFO)
        self.auth_logger.handlers.clear()
        auth_handler = TimedRotatingFileHandler(
            os.path.join(self.log_dir, 'auth.log'), when='midnight', backupCount=14, encoding='utf-8'
        )
        auth_handler.setFormatter(formatter)
        self.auth_logger.addHandler(auth_handler)
        
        # Логгер для файлов
        self.file_logger = logging.getLogger('file_operations')
        self.file_logger.setLevel(logging.INFO)
        self.file_logger.handlers.clear()
        file_handler = TimedRotatingFileHandler(
            os.path.join(self.log_dir, 'files.log'), when='midnight', backupCount=14, encoding='utf-8'
        )
        file_handler.setFormatter(formatter)
        self.file_logger.addHandler(file_handler)
        
        # Логгер для админа
        self.admin_logger = logging.getLogger('admin_actions')
        self.admin_logger.setLevel(logging.INFO)
        self.admin_logger.handlers.clear()
        admin_handler = TimedRotatingFileHandler(
            os.path.join(self.log_dir, 'admin.log'), when='midnight', backupCount=14, encoding='utf-8'
        )
        admin_handler.setFormatter(formatter)
        self.admin_logger.addHandler(admin_handler)
    
    def log_auth(self, message: str, user_id: int = None, action: str = None):
        """Логирование аутентификации"""
        log_msg = f"Пользователь {user_id}: {action} - {message}" if user_id else message
        self.auth_logger.info(log_msg)
        self.main_logger.info(f"AUTH: {log_msg}")
    
    def log_file_operation(self, message: str, user_id: int, filename: str, operation: str):
        """Логирование операций с файлами"""
        log_msg = f"Пользователь {user_id}: {operation} файл '{filename}' - {message}"
        self.file_logger.info(log_msg)
        self.main_logger.info(f"FILE: {log_msg}")
    
    def log_admin_action(self, message: str, admin_id: int, action: str):
        """Логирование действий администратора"""
        log_msg = f"Администратор {admin_id}: {action} - {message}"
        self.admin_logger.info(log_msg)
        self.main_logger.info(f"ADMIN: {log_msg}")
    
    def log_error(self, message: str, error: Exception = None):
        """Логирование ошибок"""
        error_msg = f"{message}"
        if error:
            error_msg += f" | Ошибка: {str(error)}"
        self.main_logger.error(f"ОШИБКА: {error_msg}")
    
    def get_logs(self, log_type: str, limit: int = 100) -> List[Dict]:
        """Получение логов по типу"""
        log_files = {
            'main': 'main.log',
            'auth': 'auth.log', 
            'files': 'files.log',
            'admin': 'admin.log'
        }
        
        log_file = log_files.get(log_type)
        if not log_file:
            return []
        
        log_path = os.path.join(self.log_dir, log_file)
        if not os.path.exists(log_path):
            return []
        
        try:
            with open(log_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            logs = []
            for line in lines[-limit:]:
                if line.strip():
                    # Парсинг строки лога
                    parts = line.split(' - ', 3)
                    if len(parts) >= 4:
                        logs.append({
                            'timestamp': parts[0],
                            'logger': parts[1],
                            'level': parts[2],
                            'message': parts[3].strip()
                        })
            
            return logs[::-1]  # Новые сверху
        except Exception as e:
            return [{'error': f'Ошибка чтения логов: {str(e)}'}]
    
    def get_log_stats(self) -> Dict:
        """Статистика логов"""
        stats = {}
        log_types = ['main', 'auth', 'files', 'admin']
        
        for log_type in log_types:
            log_file = os.path.join(self.log_dir, f'{log_type}.log')
            if os.path.exists(log_file):
                with open(log_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                stats[log_type] = len(lines)
            else:
                stats[log_type] = 0
        
        return stats

# Глобальный экземпляр логгера
logger = CyrillicLogger()