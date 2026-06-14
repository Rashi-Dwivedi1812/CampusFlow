import os
from typing import Any

import requests


def _backend_url() -> str:
    return os.getenv("NODE_BACKEND_URL", "http://localhost:5001").rstrip("/")


async def fetch_dashboard(session_id: str | None) -> dict[str, Any] | None:
    if not session_id:
        return None

    try:
        response = requests.post(
            f"{_backend_url()}/api/jportal/dashboard",
            json={"sessionId": session_id},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("dashboard") if data.get("success") else None
    except requests.RequestException:
        return None


async def fetch_attendance(session_id: str | None) -> dict[str, Any] | None:
    if not session_id:
        return None

    try:
        response = requests.post(
            f"{_backend_url()}/api/jportal/attendance",
            json={"sessionId": session_id},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("attendance") if data.get("success") else None
    except requests.RequestException:
        return None


async def fetch_subjects(session_id: str | None) -> dict[str, Any] | None:
    if not session_id:
        return None

    try:
        response = requests.post(
            f"{_backend_url()}/api/jportal/subjects",
            json={"sessionId": session_id},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("subjects") if data.get("success") else None
    except requests.RequestException:
        return None


async def fetch_exams(session_id: str | None) -> dict[str, Any] | None:
    if not session_id:
        return None

    try:
        response = requests.post(
            f"{_backend_url()}/api/jportal/exams",
            json={"sessionId": session_id},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("exams") if data.get("success") else None
    except requests.RequestException:
        return None
