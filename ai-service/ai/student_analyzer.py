from typing import Any

from utils.data_utils import as_list, first_present, get_nested, to_float


def analyze_student(profile: dict[str, Any] | None = None, attendance_health: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    profile = profile or {}
    general = get_nested(profile, ["generalinformation"], {})
    attendance_items = attendance_health or []

    percentages = [item.get("attendance") for item in attendance_items if isinstance(item.get("attendance"), (int, float))]
    average_attendance = round(sum(percentages) / len(percentages), 2) if percentages else 0
    risky_subjects = [item for item in attendance_items if item.get("risk") in {"critical", "high"}]

    return {
        "student_name": general.get("studentname") or profile.get("student_name"),
        "branch": general.get("branch"),
        "average_attendance": average_attendance,
        "risky_subject_count": len(risky_subjects),
        "overall_health": "needs_attention" if risky_subjects else "healthy",
    }
