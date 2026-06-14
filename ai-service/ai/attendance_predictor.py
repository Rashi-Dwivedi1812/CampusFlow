import math
from typing import Any

from utils.data_utils import as_list, first_present, to_float, to_int


def _subject_name(item: dict[str, Any], subjects: dict[str, str] | None = None) -> str:
    code = first_present(item, ["subjectcode", "subject_code", "code", "subject"])
    if code and subjects and str(code) in subjects:
        return subjects[str(code)]
    return str(code or first_present(item, ["subjectdesc", "subject_name", "name"]) or "Subject")


def _percentage(item: dict[str, Any]) -> float:
    value = first_present(
        item,
        [
            "attendance",
            "percentage",
            "attendance_percentage",
            "Ppercentage",
            "LTpercantage",
            "Lpercentage",
            "total_percentage",
        ],
    )
    percentage = to_float(value)
    if percentage is not None:
        return max(0.0, min(100.0, percentage))

    attended = to_int(first_present(item, ["present", "attended", "ltpresent", "lpresent", "present_count"]))
    conducted = to_int(first_present(item, ["total", "conducted", "lttotal", "ltotal", "total_classes"]))
    if attended and conducted:
        return max(0.0, min(100.0, round((attended / conducted) * 100, 2)))

    return 0.0


def _attended_and_conducted(item: dict[str, Any]) -> tuple[int | None, int | None]:
    attended = first_present(item, ["present", "attended", "ltpresent", "lpresent", "present_count"])
    conducted = first_present(item, ["total", "conducted", "lttotal", "ltotal", "total_classes"])

    attended_number = to_int(attended, -1) if attended not in (None, "") else -1
    conducted_number = to_int(conducted, -1) if conducted not in (None, "") else -1

    if attended_number >= 0 and conducted_number > 0:
        return attended_number, conducted_number

    percentage = _percentage(item)
    if percentage > 0:
        return round(percentage), 100

    return None, None


def analyze_attendance_record(item: dict[str, Any], subjects: dict[str, str] | None = None) -> dict[str, Any]:
    subject = _subject_name(item, subjects)
    attendance = _percentage(item)
    attended, conducted = _attended_and_conducted(item)

    if attendance < 65:
        risk = "critical"
    elif attendance < 75:
        risk = "high"
    elif attendance < 85:
        risk = "medium"
    else:
        risk = "low"

    if attended is not None and conducted:
        required_classes = max(0, math.ceil(((0.75 * conducted) - attended) / 0.25))
        safe_skips = max(0, math.floor((attended - (0.75 * conducted)) / 0.25))
    else:
        required_classes = 0 if attendance >= 75 else math.ceil((75 - attendance) / 2.5)
        safe_skips = 0 if attendance < 85 else math.floor((attendance - 75) / 2.5)

    if risk in {"critical", "high"}:
        recommendation = f"Attend next {required_classes} {subject} classes to reach 75% attendance."
        prediction = "Likely eligibility risk if upcoming classes are missed."
    elif risk == "medium":
        recommendation = f"Maintain attendance. Safe skip allowance is {safe_skips} class(es)."
        prediction = "Stable, but one or two absences can create risk."
    else:
        recommendation = f"Attendance is healthy. Safe skip allowance is {safe_skips} class(es)."
        prediction = "Low risk for the current threshold."

    return {
        "subject": subject,
        "attendance": round(attendance, 2),
        "risk": risk,
        "safe_skips": int(safe_skips),
        "required_classes": int(required_classes),
        "recommendation": recommendation,
        "prediction": prediction,
    }


def _subject_map(subjects: Any) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for subject in as_list(subjects):
        if not isinstance(subject, dict):
            continue
        code = subject.get("subjectcode") or subject.get("code") or subject.get("id")
        name = subject.get("subjectdesc") or subject.get("subject_name") or subject.get("name") or code
        if code:
            mapping[str(code)] = str(name)
    return mapping


def analyze_attendance(attendance: Any, subjects: Any = None) -> list[dict[str, Any]]:
    mapping = _subject_map(subjects)
    records = []

    if isinstance(attendance, dict):
        nested = attendance.get("attendance")
        if isinstance(nested, dict):
            records = as_list(nested.get("studentattendancelist"))
        else:
            records = as_list(nested)
    elif isinstance(attendance, list):
        records = attendance

    return [
        analyze_attendance_record(record, mapping)
        for record in records
        if isinstance(record, dict)
    ]
