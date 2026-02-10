"""
Cross-Encoder Re-Ranker Module - Smart re-ordering of search candidates

WHAT THIS DOES:
---------------
A cross-encoder takes a (query, document) pair and produces a relevance score.
Unlike bi-encoders that embed query and document separately, cross-encoders
process both together, allowing deeper interaction between query and document tokens.

WHY WE NEED THIS:
-----------------
After merging vector search + BM25 results, the ranking is approximate.
The cross-encoder re-examines the top candidates with more attention and
re-orders them for better precision.

MODEL USED:
-----------
cross-encoder/ms-marco-MiniLM-L-6-v2  (from sentence-transformers, no new package needed)
- Small and fast (~22M parameters)
- Trained on MS MARCO passage ranking
- Returns a relevance logit for each (query, document) pair
"""

from typing import List, Dict, Any, Optional
from sentence_transformers import CrossEncoder


class Reranker:
    """
    Cross-encoder re-ranker using ms-marco-MiniLM-L-6-v2.

    Usage:
        reranker = Reranker()
        reranked = reranker.rerank("computer science in canada", candidates, top_k=5)
    """

    MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    def __init__(self):
        print(f"Loading cross-encoder model: {self.MODEL_NAME}")
        self._model = CrossEncoder(self.MODEL_NAME)
        print("Cross-encoder re-ranker ready!")

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int = 10,
        doc_key: str = "document",
    ) -> List[Dict[str, Any]]:
        """
        Re-rank candidates using the cross-encoder.

        Args:
            query: The user query string
            candidates: List of candidate dicts, each must have `doc_key` field
            top_k: Number of results to keep after re-ranking
            doc_key: Key in candidate dict that holds the document text

        Returns:
            Re-ranked list (best first), each dict gets an added 'rerank_score' (0-1).
        """
        if not candidates:
            return []

        # Build (query, document) pairs
        pairs = []
        for c in candidates:
            text = c.get(doc_key, "")
            pairs.append((query, text))

        # Score all pairs at once
        raw_scores = self._model.predict(pairs)

        # Normalize scores to 0-1 via sigmoid
        import numpy as np
        sigmoid_scores = 1.0 / (1.0 + np.exp(-np.array(raw_scores)))

        # Attach scores and sort
        for i, c in enumerate(candidates):
            c["rerank_score"] = float(sigmoid_scores[i])

        # Sort descending by rerank_score
        reranked = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)

        return reranked[:top_k]
