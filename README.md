# IFC Auth Service

## Quick Start

1. Create virtualenv and install dependencies:
```
pip install -r requirements.txt
```

2. Configure environment:
- Copy `.env.example` to `.env` and set values (SECRET_KEY, DATABASE_URL or POSTGRES_*, MINIO_*, MAIL_*, GOOGLE_*, REDIS_*).

3. Run:
```
python start.py
```

## Dev / Prod
- `DEBUG=true` enables relaxed cookies (SameSite=lax) and verbose logs.
- In production set `COOKIE_SECURE=true` and `COOKIE_SAMESITE=strict`.

## Services
- DB: SQLite by default; PostgreSQL via POSTGRES_* or DATABASE_URL.
- MinIO: used for file storage (bucket `user-files`).
- Redis (optional): caching & login rate-limit.

## Security
- JWT in Authorization header & HttpOnly cookie.
- CSRF: double submit token (cookie `csrf_token` + header `X-CSRF-Token`).
- Rate-limit login per IP/email.

## API Envelope
- All `/api/*` return `{ success, message, data, meta }` or `{ success:false, message, code, details }`.

## Migrations (planned)
- Alembic will be used to manage schema changes.

# IFC Auth Service

Модуль аутентификации и авторизации для веб-сервиса работы с IFC файлами, построенный на принципах Unix философии и дизайна Google.

## 🚀 Особенности

- **FastAPI Backend** - Современный, быстрый веб-фреймворк
- **JWT Authentication** - Безопасная аутентификация с токенами
- **SQLite/PostgreSQL** - Гибкая поддержка баз данных
- **Bootstrap UI** - Современный, адаптивный интерфейс
- **MinIO Integration** - S3-совместимое хранилище файлов
- **Docker Support** - Контейнеризация для продакшена

## 📁 Структура проекта

```
Auth/
├── app/
│   ├── auth/           # Модуль аутентификации
│   ├── models/          # Модели данных
│   ├── database/        # Подключение к БД
│   ├── templates/       # HTML шаблоны
│   └── static/          # CSS, JS, изображения
├── main.py             # Основное приложение
├── config.py           # Конфигурация
├── requirements.txt    # Зависимости
├── docker-compose.yml  # Docker конфигурация
└── test_app.py         # Тесты
```

## 🛠 Установка и запуск

### 1. Активация виртуального окружения

```bash
# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 3. Запуск приложения

```bash
python main.py
```

Приложение будет доступно по адресу: http://localhost:8000

### 4. Запуск с Docker (опционально)

```bash
# Запуск PostgreSQL и MinIO
docker-compose up -d

# Запуск приложения
python main.py
```

## 🔧 Конфигурация

Основные настройки в `config.py`:

- **DATABASE_URL** - URL базы данных
- **SECRET_KEY** - Секретный ключ для JWT
- **MINIO_ENDPOINT** - Адрес MinIO сервера
- **ACCESS_TOKEN_EXPIRE_MINUTES** - Время жизни токена

## 📱 Веб-интерфейс

### Доступные страницы:

- `/` - Главная страница
- `/login` - Вход в систему
- `/register` - Регистрация
- `/dashboard` - Личный кабинет
- `/admin` - Админ-панель (только для админов)

### API Endpoints:

- `POST /auth/register` - Регистрация пользователя
- `POST /auth/login` - Вход в систему
- `GET /auth/me` - Информация о текущем пользователе
- `GET /dashboard` - Данные дашборда
- `GET /admin/users` - Список пользователей (админ)
- `GET /admin/stats` - Статистика (админ)

## 🧪 Тестирование

```bash
# Запуск тестов
python test_app.py
```

## 🔐 Безопасность

- Пароли хешируются с помощью bcrypt
- JWT токены с настраиваемым временем жизни
- Защита от CSRF атак
- Валидация входных данных

## 📊 Мониторинг

- Health check: `GET /health`
- Логирование всех операций
- Метрики использования хранилища

## 🚀 Развертывание

### Продакшен с Docker:

1. Настройте переменные окружения
2. Запустите `docker-compose up -d`
3. Настройте reverse proxy (nginx)
4. Настройте SSL сертификаты

### Переменные окружения:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db
SECRET_KEY=your-secret-key
MINIO_ENDPOINT=minio.example.com
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
```

## 🔄 Интеграция с IFC сервисом

Этот модуль предназначен для интеграции с веб-сервисом работы с IFC файлами на базе [ThatOpen Engine](https://github.com/ThatOpen/).

### Планируемые интеграции:

- Загрузка и хранение IFC файлов в MinIO
- Просмотр IFC моделей в браузере
- Управление правами доступа к файлам
- API для работы с файлами

## 📝 Лицензия

MIT License

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Создайте Pull Request

## 📞 Поддержка

При возникновении проблем создайте Issue в репозитории или обратитесь к документации FastAPI.


