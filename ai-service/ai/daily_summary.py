import time
from datetime import date
from typing import Any

from ai.attendance_predictor import analyze_attendance
from ai.recommendation_engine import generate_recommendations
from services.classroom_service import fetch_assignments
from services.jportal_service import fetch_dashboard as fetch_portal_dashboard
from utils.data_utils import as_list, compact_text, first_present, get_nested
from utils.time_utils import days_until, is_today, parse_date

_summary_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_TTL = 300


def clear_summary_cache() -> None:
    _summary_cache.clear()


def _cache_key(session_id: str | None) -> str:
    return session_id or "anonymous"


def _get_cached(session_id: str | None) -> dict[str, Any] | None:
    cached = _summary_cache.get(_cache_key(session_id))
    if not cached:
        return None
    timestamp, payload = cached
    if time.time() - timestamp > _CACHE_TTL:
        _summary_cache.pop(_cache_key(session_id), None)
        return None
    return payload


def _set_cached(session_id: str | None, payload: dict[str, Any]) -> None:
    _summary_cache[_cache_key(session_id)] = (time.time(), payload)


def _student_name(profile: dict[str, Any] | None, requested_name: str | None = None) -> str:
    if requested_name:
        return requested_name
    name = get_nested(profile, ["generalinformation", "studentname"])
    return str(name or "there")


def _today_classes(timetable: Any) -> list[dict[str, Any]]:
    classes = []
    for slot in as_list(timetable):
        if not isinstance(slot, dict):
            continue
        if not is_today(slot.get("date") or slot.get("day_date") or slot.get("class_date")):
            continue
        classes.append(
            {
                "subject": compact_text(slot.get("subject") or slot.get("title") or slot.get("course"), 120),
                "time": compact_text(slot.get("start_time") or slot.get("startTime") or slot.get("from"), 40),
                "location": compact_text(slot.get("location") or slot.get("room"), 80),
            }
        )
    return classes


def _pending_assignments(assignments: Any) -> list[dict[str, Any]]:
    pending = []
    today = date.today()
    for assignment in as_list(assignments):
        if not isinstance(assignment, dict):
            continue
        due = parse_date(assignment.get("dueDate") or assignment.get("due_date") or assignment.get("deadline"))
        if due and due < today:
            continue
        pending.append(
            {
                "title": compact_text(assignment.get("title") or "Assignment", 140),
                "course": compact_text(assignment.get("courseName") or assignment.get("course") or "Course", 120),
                "due_date": due.isoformat() if due else None,
                "days_left": days_until(due),
                "link": assignment.get("link"),
            }
        )

    pending.sort(key=lambda item: (item["due_date"] is None, item["due_date"] or "9999-12-31"))
    return pending[:5]


def _important_notices(notices: Any) -> list[dict[str, Any]]:
    important = []
    keywords = ("exam", "deadline", "attendance", "placement", "fee", "urgent", "registration", "class")
    for notice in as_list(notices):
        text = compact_text(notice, 500)
        lowered = text.lower()
        if any(keyword in lowered for keyword in keywords):
            important.append(
                {
                    "title": compact_text(first_present(notice, ["title", "subject", "headline"]) if isinstance(notice, dict) else notice, 140),
                    "text": text[:240],
                    "source": compact_text(first_present(notice, ["source", "platform", "category"]) if isinstance(notice, dict) else "Campus", 80),
                }
            )
    return important[:5]


def _placement_reminders(notices: Any, deadlines: Any) -> list[dict[str, Any]]:
    reminders = []
    keywords = ("placement", "internship", "recruitment", "drive", "training", "registration")
    for item in as_list(notices) + as_list(deadlines):
        text = compact_text(item, 500).lower()
        if any(keyword in text for keyword in keywords):
            reminders.append(compact_text(item, 240))
    return reminders[:3]


def _normalize_dashboard_payload(request: Any) -> dict[str, Any]:
    dashboard = request.dashboard if hasattr(request, "dashboard") else None
    profile = request.profile if hasattr(request, "profile") else None
    if dashboard is None:
        dashboard = {}

    return {
        "profile": profile or dashboard.get("profile"),
        "attendance": request.attendance if hasattr(request, "attendance") else dashboard.get("attendance"),
        "subjects": request.subjects if hasattr(request, "subjects") else dashboard.get("subjects"),
        "exams": request.exams if hasattr(request, "exams") else dashboard.get("exams"),
        "assignments": request.assignments if hasattr(request, "assignments") else dashboard.get("assignments"),
        "notices": request.notices if hasattr(request, "notices") else dashboard.get("notices"),
        "timetable": request.timetable if hasattr(request, "timetable") else dashboard.get("timetable"),
        "deadlines": request.deadlines if hasattr(request, "deadlines") else dashboard.get("deadlines"),
        "studentName": request.studentName if hasattr(request, "studentName") else None,
    }


async def build_daily_summary(request: Any) -> dict[str, Any]:
    cached = _get_cached(request.sessionId if hasattr(request, "sessionId") else None)
    if cached:
        return cached

    payload = _normalize_dashboard_payload(request)
    if not payload.get("profile") and hasattr(request, "sessionId") and request.sessionId:
        dashboard = await fetch_portal_dashboard(request.sessionId)
        if dashboard:
            payload.update(
                {
                    "profile": dashboard.get("profile"),
                    "attendance": dashboard.get("attendance"),
                    "subjects": dashboard.get("subjects"),
                    "exams": dashboard.get("exams"),
                }
            )

    if not payload.get("assignments") and hasattr(request, "sessionId") and request.sessionId:
        payload["assignments"] = await fetch_assignments()

    profile = payload.get("profile") or {}
    attendance_health = analyze_attendance(payload.get("attendance"), payload.get("subjects"))
    today_classes = _today_classes(payload.get("timetable"))
    pending_assignments = _pending_assignments(payload.get("assignments"))
    important_notices = _important_notices(payload.get("notices"))
    placement_reminders = _placement_reminders(payload.get("notices"), payload.get("deadlines"))
    recommendations = generate_recommendations(
        assignments=payload.get("assignments"),
        attendance_health=attendance_health,
        exams=payload.get("exams"),
        timetable=payload.get("timetable"),
        notices=payload.get("notices") or payload.get("deadlines"),
    )

    response = {
        "greeting": f"Good Morning {_student_name(profile, payload.get('studentName'))}",
        "class_count": len(today_classes),
        "todays_classes": today_classes or [{"subject": "No timetable data available", "time": "", "location": ""}],
        "attendance_alerts": [item for item in attendance_health if item.get("risk") in {"critical", "high"}],
        "pending_assignments": pending_assignments,
        "important_notices": important_notices,
        "placement_reminders": placement_reminders,
        "recommended_actions": [item["text"] for item in recommendations.get("recommendations", [])],
        "attendance_health": attendance_health,
        "generated_at": date.today().isoformat(),
    }

    _set_cached(request.sessionId if hasattr(request, "sessionId") else None, response)
    return response
