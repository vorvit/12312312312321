from typing import Any, Optional, Dict


def api_ok(data: Any = None, message: str = "OK", meta: Optional[Dict] = None) -> Dict:
    return {
        "success": True,
        "message": message,
        "data": data,
        "meta": meta or {}
    }


def api_error(message: str, code: Optional[str] = None, details: Any = None, status: int = 400) -> Dict:
    return {
        "success": False,
        "message": message,
        "code": code,
        "details": details,
        "status": status
    }



