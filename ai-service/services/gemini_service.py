import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


class GeminiService:
    def __init__(self) -> None:
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self._client = None
        if self.api_key:
            try:
                import google.generativeai as genai

                genai.configure(api_key=self.api_key)
                self._client = genai
            except Exception:
                self._client = None

    @property
    def available(self) -> bool:
        return bool(self.api_key and self._client)

    def generate_text(self, prompt: str, temperature: float = 0.2) -> str:
        if not self.available:
            return ""

        try:
            model = self._client.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(
                prompt,
                generation_config={"temperature": temperature},
            )
            return response.text.strip()
        except Exception:
            return ""

    def generate_json(self, prompt: str, schema: dict[str, Any] | None = None, temperature: float = 0.2) -> dict[str, Any]:
        if not self.available:
            return {}

        try:
            model = self._client.GenerativeModel("gemini-1.5-flash")
            generation_config = {"temperature": temperature}
            if schema:
                generation_config["response_mime_type"] = "application/json"
                generation_config["response_schema"] = schema

            response = model.generate_content(prompt, generation_config=generation_config)
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
