from datetime import datetime, timedelta
from typing import Any

from utils.data_utils import as_list, compact_text
from utils.time_utils import is_today, parse_date


def _parse_time(value: Any) -> tuple[int, int] | None:
    if not value:
        return None
    if isinstance(value, str):
        text = value.strip()
        for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p"):
            try:
                parsed = datetime.strptime(text, fmt)
                return parsed.hour, parsed.minute
            except ValueError:
                continue
    return None


def _slot_date(slot: dict[str, Any]) -> Any:
    return slot.get("date") or slot.get("day_date") or slot.get("class_date")


def _slot_title(slot: dict[str, Any]) -> str:
    return compact_text(slot.get("title") or slot.get("subject") or slot.get("activity") or "Study block")


def optimize_schedule(timetable: Any = None, assignments: Any = None, exams: Any = None) -> dict[str, Any]:
    free_slots: list[dict[str, Any]] = []

    for slot in as_list(timetable):
        if not isinstance(slot, dict):
            continue
        if not (slot.get("is_free") or slot.get("free_slot") or slot.get("type") == "free"):
            continue
        if not is_today(_slot_date(slot)):
            continue

        start = _parse_time(slot.get("start_time") or slot.get("startTime") or slot.get("from"))
        end = _parse_time(slot.get("end_time") or slot.get("endTime") or slot.get("to"))
        if not start or not end:
            continue

        start_dt = datetime.combine(datetime.today().date(), datetime.min.time()).replace(hour=start[0], minute=start[1])
        end_dt = datetime.combine(datetime.today().date(), datetime.min.time()).replace(hour=end[0], minute=end[1])
        duration_minutes = max(0, int((end_dt - start_dt).total_seconds() // 60))

        free_slots.append(
            {
                "start_time": start_dt.strftime("%H:%M"),
                "end_time": end_dt.strftime("%H:%M"),
                "duration_minutes": duration_minutes,
                "suggestion": _suggest_activity(duration_minutes, assignments, exams),
            }
        )

    return {
        "free_slots": free_slots,
        "optimized_plan": free_slots[:3],
    }


def _suggest_activity(duration_minutes: int, assignments: Any, exams: Any) -> str:
    if duration_minutes < 30:
        return "Review notices or revise flashcards."
    if assignments and as_list(assignments):
        return "Work on the nearest assignment deadline."
    if exams and as_list(exams):
        return "Revise the nearest exam topic."
    return "Study a high-priority subject without distractions."
