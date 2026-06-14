import hashlib
import os
from typing import Any

import numpy as np


class EmbeddingService:
    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or os.getenv(
            "EMBEDDING_MODEL",
            "sentence-transformers/all-MiniLM-L6-v2",
        )
        self.dimension = 384
        self._model = None

        try:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)
            if hasattr(self._model, "encode"):
                sample = self._model.encode(["dimension probe"], normalize_embeddings=True)
                self.dimension = int(np.array(sample).shape[-1])
        except Exception:
            self._model = None

    @property
    def available(self) -> bool:
        return self._model is not None

    def embed(self, texts: list[str]) -> list[list[float]]:
        safe_texts = [text or "" for text in texts]
        if self._model is not None:
            vectors = self._model.encode(
                safe_texts,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            return np.array(vectors, dtype="float32").tolist()

        return [self._hash_vector(text) for text in safe_texts]

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]

    def _hash_vector(self, text: str) -> list[float]:
        tokens = text.lower().split()
        vector = np.zeros(self.dimension, dtype="float32")
        if not tokens:
            tokens = ["empty"]

        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimension
            sign = 1.0 if int(digest[4]) % 2 == 0 else -1.0
            vector[index] += sign

        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
        return vector.tolist()


embedding_service = EmbeddingService()
