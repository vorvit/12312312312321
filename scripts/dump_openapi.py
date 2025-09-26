# -*- coding: utf-8 -*-
"""
Generate OpenAPI schema from FastAPI app and write to openapi.yaml
Usage: venv\Scripts\python scripts\dump_openapi.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.openapi.utils import get_openapi  # type: ignore
from main import app  # type: ignore


def main() -> None:
    schema = get_openapi(
        title=getattr(app, "title", "API"),
        version=getattr(app, "version", "1.0.0"),
        description=getattr(app, "description", ""),
        routes=app.routes,
    )

    out_path = ROOT / "openapi.yaml"
    try:
        import yaml  # type: ignore
    except Exception:
        print("PyYAML is required: pip install pyyaml", file=sys.stderr)
        sys.exit(1)

    with out_path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(schema, f, sort_keys=False, allow_unicode=True)
    print(f"openapi.yaml written at {out_path}")


if __name__ == "__main__":
    main()
