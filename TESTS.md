## Тесты и покрытие

### Как запустить

- Запуск всего набора:
  - Windows: `venv\Scripts\python -m pytest -q`
  - Linux/macOS: `pytest -q`
- С отчётом о покрытии (если нужен явный флаг):
  - Windows: `venv\Scripts\python -m pytest --cov=. -q`
  - Linux/macOS: `pytest --cov=. -q`

### Что проверяется (основные группы)

- tests/test_main_basic.py
  - Базовые HTML/редиректы: `/login`, `/ifc-viewer` (302, c `file`), `/`
  - Неавторизованный доступ к `/users/me` (ожидаемый 403)
  - Монты статики (в т.ч. `web-ifc` WASM)

- tests/test_csrf_and_auth.py
  - CSRF-блокировка POST без токена
  - `/auth/check` для анонимного запроса

- tests/test_login_and_roles.py
  - Регистрация/логин и `/users/me`
  - Ролевой доступ к админ-маршрутам (обычный пользователь — 403)

- tests/test_storage_and_cache.py
  - Моки MinIO для загрузки/списка файлов пользователя (`/files/upload`, `/api/files`)
  - Мок здоровья сервисов с подменой Redis/MinIO (проверка `/health`)

- tests/test_health_endpoints.py
  - `/health` с типизацией статусов сервисов
  - Саб-эндпоинты: `/health/database`, `/health/redis`, `/health/minio`, `/health/postgres`

- tests/test_email_routes.py
  - Забыл пароль: `/auth/forgot-password` (мок отправки письма)
  - Повторная отправка верификации: `/auth/resend-verification` (мок отправки письма)

### Покрытие кода (последний прогон)

- Общее покрытие: **~46%** (TOTAL)

Отметки по ключевым модулям (округлённо):
- `main.py`: ~37%
- `app/auth/auth.py`: ~66%
- `app/auth/dependencies.py`: ~38%
- `app/services/health_check.py`: ~32%
- `app/storage/service.py`: ~62%
- `app/cache/redis_client.py`: ~24%
- `app/schemas.py`: ~96%

Значение может незначительно отличаться от машины к машине. Для точного локального отчёта используйте команды из раздела «Как запустить».

### Заметки

- Для тестов используется in-memory SQLite; зависимость БД переопределяется в `tests/conftest.py`.
- Email/MinIO/Redis мокируются, реальные внешние вызовы не выполняются.

