import json
import os
from pathlib import Path
from typing import Any
from uuid import uuid4

import numpy as np

from ai.prompts import CHAT_SYSTEM_PROMPT
from services.embedding_service import embedding_service
from services.gemini_service import gemini_service
from utils.data_utils import as_list, compact_text


class RagChatbot:
    def __init__(self, index_dir: str | None = None) -> None:
        self.index_dir = Path(index_dir or os.getenv("VECTOR_DB_DIR", "vector_db"))
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self.documents: list[dict[str, Any]] = []
        self.embeddings: list[list[float]] = []
        self.faiss_index = None
        self._load_index()

    def _load_index(self) -> None:
        metadata_path = self.index_dir / "metadata.json"
        index_path = self.index_dir / "index.faiss"
        if not metadata_path.exists():
            return

        try:
            self.documents = json.loads(metadata_path.read_text(encoding="utf-8"))
            if not self.documents:
                return

            self.embeddings = embedding_service.embed([doc.get("text", "") for doc in self.documents])
            try:
                import faiss

                dimension = len(self.embeddings[0])
                self.faiss_index = faiss.IndexFlatL2(dimension)
                self.faiss_index.add(np.array(self.embeddings, dtype="float32"))
                if index_path.exists():
                    self.faiss_index = faiss.read_index(str(index_path))
            except Exception:
                self.faiss_index = None
        except Exception:
            self.documents = []
            self.embeddings = []
            self.faiss_index = None

    def _save_index(self) -> None:
        (self.index_dir / "metadata.json").write_text(
            json.dumps(self.documents, indent=2),
            encoding="utf-8",
        )
        if self.faiss_index is not None:
            try:
                import faiss

                faiss.write_index(self.faiss_index, str(self.index_dir / "index.faiss"))
            except Exception:
                pass

    def add_documents(self, documents: list[dict[str, Any]]) -> None:
        changed = False

        for document in documents:
            if not isinstance(document, dict) or not document.get("text"):
                continue

            document = dict(document)
            document.setdefault("id", str(uuid4()))
            document["text"] = compact_text(document["text"], 2500)

            replaced = False
            for index, existing in enumerate(self.documents):
                if existing.get("id") == document["id"]:
                    self.documents[index] = document
                    replaced = True
                    changed = True
                    break

            if not replaced:
                self.documents.append(document)
                changed = True

        if not changed:
            return

        new_embeddings = embedding_service.embed([doc["text"] for doc in self.documents])
        self.embeddings = new_embeddings

        try:
            import faiss

            dimension = len(self.embeddings[0]) if self.embeddings else 384
            self.faiss_index = faiss.IndexFlatL2(dimension)
            if self.embeddings:
                self.faiss_index.add(np.array(self.embeddings, dtype="float32"))
        except Exception:
            self.faiss_index = None

        self._save_index()

    def retrieve(self, query: str, top_k: int = 4) -> list[dict[str, Any]]:
        if not self.documents:
            return []

        query_embedding = embedding_service.embed_one(query)
        if self.faiss_index is not None and self.embeddings:
            try:
                scores, indices = self.faiss_index.search(
                    np.array([query_embedding], dtype="float32"),
                    min(top_k, len(self.documents)),
                )
                return [self.documents[int(index)] for index in indices[0] if index != -1]
            except Exception:
                pass

        similarities = []
        for index, document_embedding in enumerate(self.embeddings):
            similarity = float(np.dot(np.array(query_embedding), np.array(document_embedding)))
            similarities.append((similarity, index))
        similarities.sort(reverse=True)
        return [self.documents[index] for _, index in similarities[:top_k]]

    def _context_fallback_answer(self, message: str, context_items: list[dict[str, Any]]) -> str:
        lowered = message.lower()
        if "attendance" in lowered:
            lines = []
            for item in context_items:
                text = str(item.get("text", ""))
                if "attendance" in text.lower() or "percentage" in text.lower() or "present" in text.lower():
                    lines.append(f"{item.get('title') or item.get('source')}: {text[:300]}")
            if lines:
                return "Verified context found:\n" + "\n".join(lines[:3])
            return "No verified attendance data is available in the current context."

        if "exam" in lowered:
            lines = []
            for item in context_items:
                text = str(item.get("text", ""))
                if "exam" in text.lower() or "event" in text.lower():
                    lines.append(f"{item.get('title') or item.get('source')}: {text[:300]}")
            if lines:
                return "Verified context found:\n" + "\n".join(lines[:3])
            return "No verified exam information is available in the current context."

        if "assignment" in lowered or "deadline" in lowered:
            lines = []
            for item in context_items:
                text = str(item.get("text", ""))
                if "assignment" in text.lower() or "deadline" in text.lower() or "due" in text.lower():
                    lines.append(f"{item.get('title') or item.get('source')}: {text[:300]}")
            if lines:
                return "Verified context found:\n" + "\n".join(lines[:3])
            return "No verified assignment data is available in the current context. Connect Google Classroom or provide assignment details."

        if "faculty" in lowered or "subject" in lowered:
            lines = []
            for item in context_items:
                text = str(item.get("text", ""))
                if "faculty" in text.lower() or "subject" in text.lower() or "credits" in text.lower():
                    lines.append(f"{item.get('title') or item.get('source')}: {text[:300]}")
            if lines:
                return "Verified context found:\n" + "\n".join(lines[:3])
            return "No verified faculty or subject data is available in the current context."

        first = context_items[0]
        return f"Verified context found from {first.get('source', 'CampusFlow')}: {str(first.get('text', ''))[:500]}"

    def _general_fallback_answer(self, message: str) -> str:
        lowered = message.lower()
        if any(word in lowered for word in ("hello", "hi ", "hey")):
            return "Hi! I can help with campus questions, study planning, assignments, exams, or general advice."
        if "thank" in lowered:
            return "You're welcome. Ask me anything about campus life, studies, or productivity."
        if "help" in lowered:
            return "I can help with campus queries, study planning, time management, assignment strategies, exam prep, and general questions."
        return "I can answer general questions and use verified CampusFlow data when available. If you ask for attendance, exams, assignments, notices, or student-specific details, I will rely on verified context."

    def _is_general_chat(self, message: str) -> bool:
        lowered = message.lower()
        campus_terms = (
            "attendance",
            "assignment",
            "exam",
            "timetable",
            "notice",
            "faculty",
            "subject",
            "deadline",
            "placement",
            "student",
            "class",
            "portal",
            "jportal",
            "classroom",
        )
        if any(term in lowered for term in campus_terms):
            return False
        general_terms = (
            "hello",
            "hi ",
            "hey",
            "thank",
            "help",
            "joke",
            "explain",
            "what is",
            "how to",
            "study",
            "productivity",
            "career",
            "motivation",
            "who are you",
            "general",
        )
        return any(term in lowered for term in general_terms)

    def _normal_chat_answer(self, message: str) -> str:
        if gemini_service.available:
            prompt = (
                "You are the CampusFlow AI assistant. "
                "Answer this as a normal friendly chatbot. "
                "Only mention campus data if the user asks for it. "
                f"User message: {message}"
            )
            answer = gemini_service.generate_text(prompt, temperature=0.4)
            if answer:
                return answer
        return self._general_fallback_answer(message)

    def answer(self, message: str, documents: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        if documents:
            self.add_documents(documents)

        if self._is_general_chat(message):
            return {
                "answer": self._normal_chat_answer(message),
                "sources": [],
                "confidence": 0.7 if gemini_service.available else 0.3,
            }

        context_items = self.retrieve(message, top_k=4)
        if not context_items:
            if any(term in message.lower() for term in ("attendance", "assignment", "deadline", "exam", "faculty", "subject", "timetable", "notice", "placement")):
                return {
                    "answer": "No verified campus data is available in the current context. Connect the relevant source or provide the details you want me to analyze.",
                    "sources": [],
                    "confidence": 0.2,
                }

            if gemini_service.available:
                prompt = f"{CHAT_SYSTEM_PROMPT}\n\nVerified context:\nNo verified context was provided.\n\nUser question: {message}"
                answer = gemini_service.generate_text(prompt, temperature=0.2)
                return {
                    "answer": answer or self._general_fallback_answer(message),
                    "sources": [],
                    "confidence": 0.5,
                }

            return {
                "answer": self._general_fallback_answer(message),
                "sources": [],
                "confidence": 0.3,
            }

        context = "\n\n".join(
            f"Source: {item.get('source', 'CampusFlow')}\n{item.get('text', '')}"
            for item in context_items
        )
        prompt = f"{CHAT_SYSTEM_PROMPT}\n\nVerified context:\n{context}\n\nUser question: {message}"

        if gemini_service.available:
            answer = gemini_service.generate_text(prompt, temperature=0.1)
        else:
            answer = self._context_fallback_answer(message, context_items)

        if answer == "Verified information not found.":
            answer = self._context_fallback_answer(message, context_items)

        return {
            "answer": answer or "Verified information not found.",
            "sources": [
                {
                    "id": item.get("id"),
                    "source": item.get("source"),
                    "title": item.get("title"),
                }
                for item in context_items
            ],
            "confidence": 0.8 if gemini_service.available else 0,
        }


rag_chatbot = RagChatbot()
