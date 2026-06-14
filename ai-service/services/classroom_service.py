import os
from typing import Any

import requests


def _backend_url() -> str:
    return os.getenv("NODE_BACKEND_URL", "http://localhost:5001").rstrip("/")


async def fetch_assignments(headers: dict[str, str] | None = None) -> list[dict[str, Any]]:
    try:
        response = requests.get(
            f"{_backend_url()}/api/classroom/all-assignments",
            headers=headers or {},
            timeout=10,
        )
        if response.status_code == 401:
            return []
        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, list) else []
    except requests.RequestException:
        return []
