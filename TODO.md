## План рефакторинга и улучшений

### OpenAPI / контракты API
- Ввести версионирование: перенести публичные эндпоинты в `/api/v1/...`.
- Убрать JWT из query (например, `/api/files/download?token=...`); использовать `Authorization: Bearer`. Временный режим через query пометить как deprecated.
- Ввести единый конверт ответа:
  - `ApiOk<T> { success: true, message?: string, data: T }`
  - `ApiError { success: false, message: string, code?: string|int, details?: any }`
- Добавить явные модели ответов для списков (например, `FilesResponse { items: FileItem[], total?: number }`).
- Задокументировать все 4xx/5xx с моделью ошибки и примерами.
- Аннотировать заголовки (Authorization, X-CSRF-Token) и cookies там, где применимо.
- Разделить HTML-маршруты и API в OpenAPI с помощью tags (либо скрыть HTML в схеме).
- Добавить `servers` для dev/prod и `tags` по доменам (auth, files, admin, health).

### Архитектура / слои
- Вынести роутеры из `main.py` в `app/api/routers/{auth, files, admin, health}.py` с префиксами и тегами.
- Применить префикс `/api/v1` для API; HTML-маршруты оставить без версии.
- Создать сервисный слой `app/services/{auth_service, file_service, email_service, health_service}.py`.
- Вынести бизнес-правила из хендлеров в сервисы; хендлеры оставить тонкими.
- Ввести репозитории `app/repositories/{user_repo, file_repo}.py`, инкапсулирующие ORM-запросы.
- Добавить UnitOfWork для транзакционных границ в сервисах вместо прямой передачи сессий.
- Определить порты/интерфейсы адаптеров: `StoragePort`, `EmailPort`, `CachePort`.
- Реализации: MinIO/LocalFS, SMTP/Console, Redis/InMemory; провязывать через DI (FastAPI Depends).

### Безопасность и политики
- Сузить CORS (никаких `*` в проде), явный allowlist источников.
- Нормализовать семантику 401 vs 403 по всем эндпоинтам.
- Удалить потоки с токеном в query; стандартизировать `Authorization`-заголовки.

### Тестирование и CI
- Добавить e2e-тесты для загрузки/скачивания и rate limiting.
- Проверка генерации OpenAPI в CI и публикация HTML-доков как артефакта.
- Генерация клиента из `openapi.yaml` (опционально) для фронтенда.

### Шаги миграции (пошагово)
1) Перенести роутеры, добавить `/api/v1`, теги и `response_model` на каждый эндпоинт.
2) Ввести конверты `ApiOk/ApiError`; постепенно адаптировать хендлеры.
3) Выделить сервисы и репозитории; хендлеры перевести на сервисный слой.
4) Добавить порты/адаптеры и DI; заменить прямые вызовы MinIO/Redis/Email.
5) Обновить viewer на работу через `Authorization` header, задепрекейтить query token.
6) Укрепить конфиг CORS/CSRF и консистентность кодов ошибок.
