from datetime import date, datetime
from typing import Any, Optional


def parse_date(value: Any) -> Optional[date]:
    if value is None:
        return None

    if isinstance(value, date) and not isinstance(value, datetime):
        return value

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, (int, float)):
        number = int(value)
        if number > 10_000_000_000:
            number = number // 1000
        return datetime.fromtimestamp(number).date()

    if isinstance(value, dict):
        year = value.get("year")
        month = value.get("month")
        day = value.get("day")
        if year and month and day:
            try:
                return date(int(year), int(month), int(day))
            except (TypeError, ValueError):
                return None

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None

        if text.isdigit():
            return parse_date(int(text))

        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(text[:10], fmt).date()
            except ValueError:
                continue

        for fmt in ("%b %d, %Y", "%B %d, %Y", "%d %b %Y", "%d %B %Y"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                continue

    return None


def days_until(value: Any) -> Optional[int]:
    parsed = parse_date(value)
    if not parsed:
        return None
    return (parsed - date.today()).days


def is_today(value: Any) -> bool:
    parsed = parse_date(value)
    return bool(parsed and parsed == date.today())


def compact_text(value: Any, limit: int = 500) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        parts = []
        for key, item in value.items():
            if item in (None, "", [], {}):
                continue
            parts.append(f"{key}: {compact_text(item, 120)}")
        text = "; ".join(parts)
    elif isinstance(value, (list, tuple, set)):
        text = "; ".join(compact_text(item, 120) for item in value if item not in (None, "", [], {}))
    else:
        text = str(value)

    text = " ".join(text.split())
    return text[:limit]
