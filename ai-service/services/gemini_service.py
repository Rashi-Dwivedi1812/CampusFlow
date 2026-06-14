import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


class GeminiService:
    def __init__(self) -> None:
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self._client = None
        self._genai = None
        if self.api_key:
            try:
                import google.genai as google_genai

                self._genai = google_genai
                self._client = google_genai.Client(api_key=self.api_key)
            except Exception:
                self._client = None

    @property
    def available(self) -> bool:
        return bool(self.api_key and self._client)

    def generate_text(self, prompt: str, temperature: float = 0.2) -> str:
        if not self.available:
            return ""

        try:
            response = self._client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"temperature": temperature},
            )
            return response.text.strip()
        except Exception:
            return ""

    def generate_json(
        self, prompt: str, schema: dict[str, Any] | None = None, temperature: float = 0.2
    ) -> dict[str, Any]:
        if not self.available:
            return {}

        try:
            config = {"temperature": temperature}
            if schema:
                config["response_mime_type"] = "application/json"
                config["response_schema"] = schema

            response = self._client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=config,
            )
            text = response.text.strip()
        except Exception:
            return {}

        if not text:
            return {}

        import json

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(text[start : end + 1])
                except json.JSONDecodeError:
                    return {}
            return {}


gemini_service = GeminiService()
