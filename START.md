Быстрый запуск без .env (локально, dev)
1) Клонирование
git clone https://github.com/vorvit/12312312312321.git
cd 12312312312321
2) Python окружение
Установите Python 3.11+ и Node 18+
python -m venv venv
venv\Scripts\activate (Windows) или source venv/bin/activate (Unix)
pip install -r requirements.txt
3) Инициализация БД (SQLite по умолчанию)
alembic upgrade head
python create_admin.py (создаст админа, следуйте подсказкам)
python upload_test_files.py (необязательно — загрузит тестовые IFC)
4) Запуск бэкенда FastAPI
uvicorn main:app --reload
5) Запуск вьюера (в отдельном терминале)
cd TSP
npm ci (или npm install)
npm run dev -- --host
Откройте http://localhost:8000/login (бэкенд); вьюер доступен на http://localhost:5174 (через /ifc-viewer редиректом)
6) Вход и просмотр
Войдите на /login (учётка админа из create_admin.py)
На дашборде: View Files → выбрать файл → “View” откроет вьюер с моделью
Во вьюере: кнопка “S3 Storage” в Models для ручной загрузки нескольких моделей
Примечания
Без .env проект использует значения по умолчанию (SQLite, без внешних сервисов). Google OAuth работать не будет (нет CLIENT_ID/SECRET) — вход через локального админа.
Если порт 5174 занят — остановите процесс или запустите вьюер на другом порту: npm run dev -- --port 5175 --host; маршрут /ifc-viewer будет редиректить на указанный хост/порт, если вы обновите его в main.py при необходимости.
Для web-ifc загрузчика важно: TSP/public/web-ifc содержит wasm/worker файлы; они проброшены через /web-ifc в бэкенде.