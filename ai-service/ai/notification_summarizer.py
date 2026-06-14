import json
import re
from typing import Any

from ai.prompts import NOTIFICATION_SYSTEM_PROMPT
from services.gemini_service import gemini_service
from utils.data_utils import as_list, compact_text, first_present


HIGH_KEYWORDS = ("exam", "deadline", "attendance", "placement", "internship", "fee", "urgent", "last date", "registration")
MEDIUM_KEYWORDS = ("class", "lecture", "faculty", "timetable", "lab", "tutorial", "notice")
LOW_KEYWORDS = ("event", "workshop", "seminar", "club", "cultural", "sports")


def _item_text(item: Any) -> str:
    if isinstance(item, dict):
        text = " ".join(
            compact_text(item.get(key))
            for key in ("title", "text", "description", "content", "notice", "message", "subject", "announcement")
        )
        return " ".join(text.split())
    return compact_text(item)


def _source(item: Any) -> str:
    if isinstance(item, dict):
        return str(first_present(item, ["source", "platform", "category", "type"]) or "CampusFlow")
    return "CampusFlow"


def _title(item: Any) -> str:
    if isinstance(item, dict):
        return compact_text(first_present(item, ["title", "subject", "headline", "notice"]) or "Campus Update", 120)
    return compact_text(item, 120)


def _category(text: str) -> str:
    lowered = text.lower()
    if any(keyword in lowered for keyword in ("exam", "end sem", "mid sem", "practical")):
        return "exam"
    if any(keyword in lowered for keyword in ("deadline", "assignment", "submission", "last date", "due")):
        return "deadline"
    if any(keyword in lowered for keyword in ("attendance", "absent", "shortage")):
        return "attendance"
    if any(keyword in lowered for keyword in ("placement", "internship", "recruitment", "drive")):
        return "placement"
    if any(keyword in lowered for keyword in ("class", "lecture", "timetable", "lab", "tutorial")):
        return "class_change"
    if any(keyword in lowered for keyword in ("faculty", "teacher", "instructor")):
        return "faculty"
    if any(keyword in lowered for keyword in ("event", "workshop", "seminar", "club", "sports")):
        return "event"
    return "general"


def _urgency(category: str, text: str) -> str:
    lowered = text.lower()
    if category in {"exam", "deadline", "attendance", "placement"} or any(keyword in lowered for keyword in HIGH_KEYWORDS):
        return "HIGH"
    if category in {"class_change", "faculty"} or any(keyword in lowered for keyword in MEDIUM_KEYWORDS):
        return "MEDIUM"
    if category == "event" or any(keyword in lowered for keyword in LOW_KEYWORDS):
        return "LOW"
    return "LOW"


def _importance(urgency: str, category: str) -> int:
    weights = {
        "HIGH": 90,
        "MEDIUM": 60,
        "LOW": 30,
    }
    if category in {"exam", "deadline", "attendance", "placement"}:
        return min(100, weights[urgency] + 10)
    return weights[urgency]


def _clean_summary(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    noise = (
        "dear student",
        "kindly note",
        "please note",
        "this is to inform",
        "for your information",
        "regards",
        "admin",
    )
    lowered = text.lower()
    for token in noise:
        lowered = lowered.replace(token, "")
    cleaned = " ".join(lowered.split())
    return cleaned[:240] or text[:240]


def _deterministic_summary(notifications: list[Any]) -> dict[str, Any]:
    items = []
    for item in notifications:
        text = _item_text(item)
        if not text:
            continue
        category = _category(text)
        urgency = _urgency(category, text)
        items.append(
            {
                "title": _title(item),
                "summary": _clean_summary(text),
                "urgency": urgency,
                "importance": _importance(urgency, category),
                "category": category,
                "source": _source(item),
            }
        )

    items.sort(key=lambda item: (item["importance"], item["urgency"] == "HIGH"), reverse=True)
    high_count = sum(1 for item in items if item["urgency"] == "HIGH")
    summary = f"{high_count} high priority update(s) found. Focus on exams, deadlines, attendance, and placements first."
    return {"items": items[:10], "summary": summary}


def _llm_summary(notifications: list[Any]) -> dict[str, Any]:
    payload = json.dumps(notifications, default=str)[:12000]
    prompt = f"{NOTIFICATION_SYSTEM_PROMPT}\n\nNotifications:\n{payload}"
    result = gemini_service.generate_json(prompt)
    if not result:
        return {}

    items = result.get("items") if isinstance(result, dict) else None
    if not isinstance(items, list):
        return {}

    normalized = []
    for item in items:
        if not isinstance(item, dict):
            continue
        urgency = str(item.get("urgency") or "LOW").upper()
        if urgency not in {"HIGH", "MEDIUM", "LOW"}:
            urgency = "LOW"
        normalized.append(
            {
                "title": compact_text(item.get("title"), 120),
                "summary": compact_text(item.get("summary"), 240),
                "urgency": urgency,
                "importance": int(item.get("importance") or 0),
                "category": item.get("category") or "general",
                "source": compact_text(item.get("source"), 80),
            }
        )

    normalized.sort(key=lambda item: item.get("importance", 0), reverse=True)
    return {
        "items": normalized[:10],
        "summary": compact_text(result.get("summary"), 300),
    }


def summarize_notifications(notifications: Any) -> dict[str, Any]:
    notification_items = as_list(notifications)
    if not notification_items:
        return {"items": [], "summary": "No updates available."}

    result = _llm_summary(notification_items) if gemini_service.available else {}
    return result or _deterministic_summary(notification_items)
