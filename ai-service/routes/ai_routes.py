from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ai.attendance_predictor import analyze_attendance
from ai.daily_summary import build_daily_summary
from ai.notification_summarizer import summarize_notifications
from ai.rag_chatbot import rag_chatbot
from ai.recommendation_engine import generate_recommendations
from ai.schedule_optimizer import optimize_schedule
from utils.data_utils import as_list, compact_text, first_present, get_nested

router = APIRouter()


class DailySummaryRequest(BaseModel):
    sessionId: str | None = None
    dashboard: dict[str, Any] | None = None
    attendance: Any = None
    subjects: Any = None
    exams: Any = None
    assignments: Any = None
    notices: Any = None
    timetable: Any = None
    deadlines: Any = None
    profile: dict[str, Any] | None = None
    studentName: str | None = None


class AttendanceHealthRequest(BaseModel):
    sessionId: str | None = None
    attendance: Any = None
    subjects: Any = None
    dashboard: dict[str, Any] | None = None


class NotificationSummarizeRequest(BaseModel):
    sessionId: str | None = None
    notifications: Any = Field(default_factory=list)
    dashboard: dict[str, Any] | None = None


class RecommendationRequest(BaseModel):
    sessionId: str | None = None
    dashboard: dict[str, Any] | None = None
    assignments: Any = None
    attendance: Any = None
    subjects: Any = None
    exams: Any = None
    timetable: Any = None
    notices: Any = None
    deadlines: Any = None


class ChatRequest(BaseModel):
    sessionId: str | None = None
    message: str
    dashboard: dict[str, Any] | None = None
    documents: list[dict[str, Any]] | None = None


class ScheduleOptimizeRequest(BaseModel):
    sessionId: str | None = None
    dashboard: dict[str, Any] | None = None
    timetable: Any = None
    assignments: Any = None
    exams: Any = None


def _dashboard_from_request(request: Any) -> dict[str, Any]:
    if isinstance(request, dict):
        return request.get("dashboard") or {}
    return request.dashboard or {}


def _dashboard_value(request: Any, key: str) -> Any:
    if isinstance(request, dict):
        return request.get(key)
    return getattr(request, key, None)


def _build_documents(payload: dict[str, Any]) -> list[dict[str, Any]]:
    dashboard = payload.get("dashboard") or {}
    documents: list[dict[str, Any]] = []

    profile = payload.get("profile") or dashboard.get("profile")
    if profile:
        documents.append(
            {
                "id": "profile",
                "title": "Student profile",
                "source": "JPortal",
                "text": compact_text(profile, 1200),
            }
        )

    attendance = payload.get("attendance") or dashboard.get("attendance")
    if attendance:
        documents.append(
            {
                "id": "attendance",
                "title": "Attendance",
                "source": "JPortal",
                "text": compact_text(attendance, 1500),
            }
        )

    subjects = payload.get("subjects") or dashboard.get("subjects")
    if subjects:
        documents.append(
            {
                "id": "subjects",
                "title": "Subjects and faculty",
                "source": "JPortal",
                "text": compact_text(subjects, 1800),
            }
        )

    exams = payload.get("exams") or dashboard.get("exams")
    if exams:
        documents.append(
            {
                "id": "exams",
                "title": "Exam events",
                "source": "JPortal",
                "text": compact_text(exams, 1500),
            }
        )

    for index, assignment in enumerate(as_list(payload.get("assignments") or dashboard.get("assignments"))):
        if not isinstance(assignment, dict):
            continue
        documents.append(
            {
                "id": f"assignment-{index}",
                "title": compact_text(assignment.get("title"), 120),
                "source": "Google Classroom",
                "text": compact_text(assignment, 1200),
            }
        )

    for index, notice in enumerate(as_list(payload.get("notices") or dashboard.get("notices"))):
        documents.append(
            {
                "id": f"notice-{index}",
                "title": compact_text(first_present(notice, ["title", "subject", "headline"]) if isinstance(notice, dict) else notice, 120),
                "source": compact_text(first_present(notice, ["source", "platform", "category"]) if isinstance(notice, dict) else "Campus", 80),
                "text": compact_text(notice, 1200),
            }
        )

    for index, document in enumerate(payload.get("documents") or []):
        if not isinstance(document, dict):
            continue
        documents.append(
            {
                "id": document.get("id") or f"custom-{index}",
                "title": document.get("title") or "Custom document",
                "source": document.get("source") or "CampusFlow",
                "text": compact_text(document.get("text") or document.get("content") or document, 2500),
            }
        )

    return documents


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/daily-summary")
async def daily_summary_get(request: Request, sessionId: str | None = None):
    effective_session_id = sessionId or request.headers.get("x-session-id")
    return await build_daily_summary(DailySummaryRequest(sessionId=effective_session_id))


@router.post("/daily-summary")
async def daily_summary_post(payload: DailySummaryRequest):
    return await build_daily_summary(payload)


@router.post("/attendance-health")
def attendance_health(payload: AttendanceHealthRequest):
    dashboard = _dashboard_from_request(payload)
    attendance = payload.attendance or dashboard.get("attendance")
    subjects = payload.subjects or dashboard.get("subjects")
    return {"items": analyze_attendance(attendance, subjects)}


@router.post("/notifications/summarize")
def notifications_summarize(payload: NotificationSummarizeRequest):
    dashboard = _dashboard_from_request(payload)
    notifications = payload.notifications
    if notifications in (None, [], {}):
        notifications = dashboard.get("notices") or []
    return summarize_notifications(notifications)


@router.post("/recommendations")
def recommendations(payload: RecommendationRequest):
    dashboard = _dashboard_from_request(payload)
    attendance = payload.attendance or dashboard.get("attendance")
    subjects = payload.subjects or dashboard.get("subjects")
    exams = payload.exams or dashboard.get("exams")
    timetable = payload.timetable or dashboard.get("timetable")
    notices = payload.notices or dashboard.get("notices") or payload.deadlines or dashboard.get("deadlines")
    attendance_health = analyze_attendance(attendance, subjects)
    return generate_recommendations(
        assignments=payload.assignments or dashboard.get("assignments"),
        attendance_health=attendance_health,
        exams=exams,
        timetable=timetable,
        notices=notices,
    )


@router.post("/chat")
def chat(payload: ChatRequest):
    dashboard = _dashboard_from_request(payload)
    payload_dict = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    payload_dict["dashboard"] = dashboard
    documents = _build_documents(payload_dict)
    return rag_chatbot.answer(payload.message, documents)


@router.post("/schedule/optimize")
def schedule_optimize(payload: ScheduleOptimizeRequest):
    dashboard = _dashboard_from_request(payload)
    return optimize_schedule(
        timetable=payload.timetable or dashboard.get("timetable"),
        assignments=payload.assignments or dashboard.get("assignments"),
        exams=payload.exams or dashboard.get("exams"),
    )
