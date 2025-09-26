# Project Structure

High-level overview of the repository layout, with brief purpose notes for each folder/file.

```
.
├─ alembic/                      # Database migrations (Alembic)
│  ├─ env.py
│  ├─ script.py.mako             # Alembic migration template
│  └─ versions/                  # Migration scripts
│     ├─ b8d7da233dd7_add_files_table.py
│     └─ f5c105806b68_initial_schema_from_models.py
├─ alembic.ini                   # Alembic configuration
├─ app/                          # FastAPI backend application
│  ├─ __init__.py
│  ├─ api/                       # API helpers and (optionally) mock utilities
│  │  ├─ responses.py
│  ├─ auth/                      # Authentication and authorization
│  │  ├─ auth.py                 # JWT issuing/verification, auth helpers
│  │  ├─ context.py              # Current user helper for web templates
│  │  ├─ dependencies.py         # FastAPI dependencies for auth
│  │  └─ oauth_service.py        # Google OAuth integration
│  ├─ cache/                     # In-memory / external cache helpers
│  │  ├─ cache_service.py
│  │  └─ redis_client.py
│  ├─ database/                  # DB connection and base setup
│  │  ├─ base.py
│  │  └─ connection.py
│  ├─ email/                     # Email delivery services
│  │  ├─ email_service.py
│  │  └─ email_service_demo.py
│  ├─ logging/                   # Centralized logging utilities
│  │  └─ logger.py
│  ├─ models/                    # SQLAlchemy models
│  │  ├─ file.py
│  │  ├─ password_reset.py
│  │  └─ user.py
│  ├─ security/                  # Security helpers
│  │  ├─ csrf.py                 # CSRF token utils
│  │  └─ rate_limit.py           # Simple rate limiting
│  ├─ services/                  # Service-layer helpers (health checks, etc.)
│  │  └─ health_check.py
│  ├─ static/                    # Static assets served by FastAPI
│  │  ├─ css/style.css           # Global site styles (light/dark theme)
│  │  ├─ js/                     # Client-side JS for site pages
│  │  │  ├─ app.js               # Global app bootstrapping
│  │  │  ├─ dashboard.js         # Dashboard page logic
│  │  │  ├─ admin.js, admin-system.js
│  │  │  ├─ files.js, settings.js, help.js, profile.js
│  │  │  └─ ...
│  │  └─ favicon.ico
│  ├─ storage/                   # Storage abstraction (MinIO, local, etc.)
│  │  ├─ minio_client.py
│  │  └─ service.py
│  ├─ templates/                 # Jinja2 page templates
│  │  ├─ base.html               # Main layout/nav
│  │  ├─ dashboard.html          # Dashboard
│  │  ├─ ifc-viewer.html         # Server-side viewer wrapper (redirects to TSP)
│  │  ├─ admin.html, admin-users.html, admin-system.html
│  │  ├─ files.html, settings.html, help.html
│  │  ├─ login.html, register.html, forgot/reset password, verify-*.html
│  │  └─ profile.html
│  └─ schemas.py                 # Pydantic schemas
├─ TSP/                           # Frontend viewer (Vite + That Open Components)
│  ├─ index.html                 # Viewer entry (loads src/main.ts)
│  ├─ package.json               # Frontend dependencies
│  ├─ package-lock.json
│  ├─ vite.config.ts             # Vite config
│  ├─ public/
│  │  └─ web-ifc/                # web-ifc wasm + js worker files (served statically)
│  ├─ scripts/
│  │  └─ ifc2frag.cjs            # Node script for IFC→FRAG conversion
│  └─ src/
│     ├─ main.ts                 # Viewer bootstrap, That Open setup, model management
│     ├─ auth-integration.ts     # Auth + API integration for the viewer
│     ├─ cache.ts                # IndexedDB cache helpers for IFC bytes
│     ├─ globals.ts, style.css
│     ├─ ui-templates/           # UI templates (panels, toolbars) for viewer
│     │  ├─ grids/               # Layouts (viewport/content grids)
│     │  ├─ sections/            # Models, viewpoints, data panels
│     │  ├─ toolbars/            # Viewer toolbar buttons & menus
│     │  ├─ buttons/             # Aux buttons templates
│     │  └─ auth/                # S3 picker & file browser templates
│     ├─ simple-viewer.ts, main-simple.ts (aux examples)
│     └─ vite-env.d.ts
├─ backups/                       # Local backup artifacts (optional, can be cleaned)
├─ logs/                          # Runtime logs (optional, can be cleaned)
├─ main.py                        # FastAPI entrypoint (routes, mounts, /ifc-viewer redirect)
├─ config.py                      # Application config (reads env/settings)
├─ requirements.txt               # Python dependencies
├─ docker-compose.yml             # Optional docker orchestration
├─ README.md                      # Project readme
├─ STARTUP_GUIDE.md               # Local startup notes
├─ update_*.py, create_*.py, check_*.py
│                                 # Utility scripts (maintenance/experiments)
└─ venv/                          # Local Python virtualenv (not tracked)
```

## Key Responsibilities

- Backend (FastAPI): defined under `app/`, boots from `main.py`. Serves web pages, APIs, static assets, and mounts `/web-ifc` so the viewer can fetch wasm/worker files. Includes authentication (JWT + OAuth), file storage, and admin utilities.

- Frontend Viewer (TSP): Vite-based That Open Components viewer. Entry page `TSP/index.html` loads `src/main.ts`. Handles IFC loading (via `/api/files/download/...`), model list, visibility toggles, and integrates with backend auth. web-ifc wasm lives under `TSP/public/web-ifc/`.

- Database Migrations: managed by Alembic under `alembic/` with configuration in `alembic.ini`.

- Static site styling and dashboard UI: `app/static/css/style.css` (light/dark themes aligned with viewer style), `app/static/js/*.js` for specific page logic.

## Notes

- Cleanable artifacts: `logs/`, `backups/`, `TSP/node_modules/`, `venv/` are safe to regenerate.
- web-ifc runtime requirements: keep wasm/worker/js files under `TSP/public/web-ifc/`; templating/metadata files inside that folder are not required at runtime.
- The server-side route `/ifc-viewer` forwards to the Vite viewer (on port 5174) and optionally passes `token`/`file` query params.


