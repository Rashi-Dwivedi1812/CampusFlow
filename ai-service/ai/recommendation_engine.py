from datetime import date
from typing import Any

from utils.data_utils import as_list, compact_text, first_present, to_float
from utils.time_utils import days_until, parse_date


def _assignment_due_date(assignment: dict[str, Any]) -> date | None:
    return parse_date(
        assignment.get("dueDate")
        or assignment.get("due_date")
        or assignment.get("deadline")
        or assignment.get("due")
    )


def _notice_text(item: Any) -> str:
    if isinstance(item, dict):
        return compact_text(
            " ".join(
                str(item.get(key, ""))
                for key in ("title", "text", "description", "content", "notice", "message", "subject")
            )
        )
    return compact_text(item)


def _attendance_risk_score(attendance_health: list[dict[str, Any]]) -> tuple[int, str, str] | None:
    risky = [
        item
        for item in attendance_health
        if item.get("risk") in {"critical", "high"}
    ]
    if not risky:
        return None

    worst = sorted(risky, key=lambda item: item.get("attendance", 100))[0]
    return (
        95,
        f"Attend {worst.get('subject', 'the subject')} urgently. Attendance is {worst.get('attendance', 0)}%.",
        "attendance",
    )


def _assignment_recommendations(assignments: list[dict[str, Any]]) -> list[tuple[int, str, str]]:
    recommendations: list[tuple[int, str, str]] = []
    for assignment in assignments:
        if not isinstance(assignment, dict):
            continue
        due = _assignment_due_date(assignment)
        days = (due - date.today()).days if due else None
        title = assignment.get("title") or assignment.get("courseName") or "assignment"

        if days is not None and days <= 1:
            label = "today" if days == 0 else "tomorrow"
            recommendations.append(
                (
                    100 if days == 0 else 90,
                    f"Finish {title} {label}.",
                    "assignment",
                )
            )
        elif days is not None and days <= 3:
            recommendations.append(
                (
                    78,
                    f"Start {title} now. It is due in {days} days.",
                    "assignment",
                )
            )
    return recommendations


def _exam_recommendations(exams: Any) -> list[tuple[int, str, str]]:
    recommendations: list[tuple[int, str, str]] = []
    for exam in as_list(exams):
        if not isinstance(exam, dict):
            continue
        event_date = parse_date(exam.get("event_from") or exam.get("date") or exam.get("from"))
        days = (event_date - date.today()).days if event_date else None
        name = exam.get("exam_event_desc") or exam.get("name") or exam.get("title") or "exam"

        if days is not None and 0 <= days <= 7:
            recommendations.append(
                (
                    86,
                    f"Revise for {name}. It starts in {days} day(s).",
                    "exam",
                )
            )
    return recommendations


def _placement_recommendations(notices: list[Any]) -> tuple[int, str, str] | None:
    keywords = ("placement", "internship", "recruitment", "drive", "training", "registration")
    for notice in notices:
        text = _notice_text(notice).lower()
        if any(keyword in text for keyword in keywords):
            return (82, "Complete placement or internship registration steps today.", "placement")
    return None


def _free_slot_recommendation(timetable: Any) -> tuple[int, str, str] | None:
    for slot in as_list(timetable):
        if not isinstance(slot, dict):
            continue
        if slot.get("is_free") or slot.get("free_slot") or slot.get("type") == "free":
            return (
                70,
                "Use the free slot for focused study or assignment work.",
                "schedule",
            )
    return None


def generate_recommendations(
    assignments: Any = None,
    attendance_health: Any = None,
    exams: Any = None,
    timetable: Any = None,
    notices: Any = None,
    max_items: int = 3,
) -> dict[str, Any]:
    assignment_items = [item for item in as_list(assignments) if isinstance(item, dict)]
    attendance_items = [item for item in as_list(attendance_health) if isinstance(item, dict)]
    notice_items = as_list(notices)

    candidates: list[tuple[int, str, str]] = []
    candidates.extend(_assignment_recommendations(assignment_items))

    attendance_candidate = _attendance_risk_score(attendance_items)
    if attendance_candidate:
        candidates.append(attendance_candidate)

    candidates.extend(_exam_recommendations(exams))

    placement_candidate = _placement_recommendations(notice_items)
    if placement_candidate:
        candidates.append(placement_candidate)

    free_slot_candidate = _free_slot_recommendation(timetable)
    if free_slot_candidate:
        candidates.append(free_slot_candidate)

    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for score, text, category in sorted(candidates, key=lambda item: item[0], reverse=True):
        if text in seen:
            continue
        seen.add(text)
        unique.append({"score": score, "text": text, "category": category})
        if len(unique) >= max_items:
            break

    return {"recommendations": unique}


def build_recommendations_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    attendance_health = payload.get("attendance_health") or []
    return generate_recommendations(
        assignments=payload.get("assignments"),
        attendance_health=attendance_health,
        exams=payload.get("exams"),
        timetable=payload.get("timetable"),
        notices=payload.get("notices") or payload.get("deadlines"),
    )
