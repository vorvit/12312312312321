# 🚀 Руководство по запуску IFC Auth System

## 📋 Обзор системы

Система состоит из следующих компонентов:

| Сервис | Порт | Описание |
|--------|------|----------|
| **Auth Service** | 8000 | FastAPI сервер аутентификации |
| **TSP Viewer** | 5174 | Vite сервер для 3D вьюера |
| **PostgreSQL** | 5433 | База данных |
| **Redis** | 6380 | Кэш и сессии |
| **MinIO** | 9000 | Файловое хранилище |

## 🛠️ Быстрый запуск

### Вариант 1: Запуск всех сервисов (рекомендуется)

```bash
python start_all_services.py
```

Этот скрипт:
- ✅ Проверит все зависимости
- 🐳 Запустит Docker сервисы (PostgreSQL, Redis, MinIO)
- 🔐 Запустит Auth Service на порту 8000
- 🎨 Запустит TSP Viewer на порту 5174
- 🛑 Корректно остановит все сервисы при завершении

### Вариант 2: Поэтапный запуск

#### 1. Запуск Docker сервисов
```bash
python start_services.py
```

#### 2. Запуск Auth Service
```bash
python start.py
```

#### 3. Запуск TSP Viewer (в отдельном терминале)
```bash
python start_viewer.py
```

## 📦 Установка зависимостей

### Python зависимости
```bash
pip install -r requirements.txt
```

### Node.js зависимости (для TSP Viewer)
```bash
cd TSP
npm install
```

### Docker (для PostgreSQL, Redis, MinIO)
Установите Docker Desktop

## 🔧 Настройка портов

Все порты зафиксированы в конфигурации:

- **Auth Service**: `8000` (в `start.py`)
- **TSP Viewer**: `5174` (в `TSP/vite.config.ts`)
- **PostgreSQL**: `5433` (в `docker-compose.yml`)
- **Redis**: `6380` (в `docker-compose.yml`)
- **MinIO**: `9000` (в `docker-compose.yml`)

## 🌐 Доступные URL

После запуска всех сервисов:

- **Главная страница**: http://localhost:8000
- **TSP Viewer**: http://localhost:5174
- **MinIO Console**: http://localhost:9001
- **API документация**: http://localhost:8000/docs

## 🐛 Устранение проблем

### Проблема: "Порт уже используется"
```bash
# Остановите все процессы
python start_all_services.py
# Нажмите Ctrl+C для корректной остановки
```

### Проблема: "Docker не найден"
Установите Docker Desktop и перезапустите терминал

### Проблема: "npm не найден"
Установите Node.js с официального сайта

### Проблема: "Python зависимости не найдены"
```bash
pip install -r requirements.txt
```

## 📝 Логи и отладка

Все сервисы выводят подробную информацию о запуске и ошибках.

Для отладки конкретного сервиса запустите его отдельно:

```bash
# Только Auth Service
python start.py

# Только TSP Viewer  
python start_viewer.py
```

## 🛑 Остановка сервисов

- **Автоматическая остановка**: Нажмите `Ctrl+C` в терминале с `start_all_services.py`
- **Ручная остановка Docker**: `docker-compose down`
- **Остановка отдельных процессов**: `Ctrl+C` в соответствующих терминалах
