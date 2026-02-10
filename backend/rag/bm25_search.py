"""
BM25 Keyword Search Module - Complements vector search with exact keyword matching

WHAT THIS DOES:
---------------
BM25 (Best Matching 25) is a classic information retrieval algorithm that ranks
documents by keyword overlap with the query. Unlike vector search which understands
meaning, BM25 excels at finding exact name matches and specific terms.

WHY WE NEED THIS:
-----------------
Vector search alone can miss exact matches:
  Query: "University of Toronto" → Vector search might rank other Canadian schools higher
  BM25 catches this because the exact words "University of Toronto" appear in the document.

Combined with vector search via Reciprocal Rank Fusion, we get the best of both worlds.
"""

import re
from typing import List, Dict, Any, Optional

try:
    from rank_bm25 import BM25Okapi
except ImportError:
    BM25Okapi = None


def _tokenize(text: str) -> List[str]:
    """Simple whitespace + punctuation tokenizer, lowercased."""
    return re.findall(r'[a-z0-9]+', text.lower())


class BM25Index:
    """
    In-memory BM25 index built from ChromaDB document texts.

    Usage:
        index = BM25Index()
        index.build_index(ids, documents)
        results = index.search("computer science canada", top_k=10)
    """

    def __init__(self):
        self._bm25: Optional[BM25Okapi] = None
        self._ids: List[str] = []
        self._documents: List[str] = []
        self._ready = False

    @property
    def is_ready(self) -> bool:
        return self._ready

    def build_index(self, ids: List[str], documents: List[str]) -> None:
        """
        Build the BM25 index from document texts.

        Args:
            ids: Document IDs (parallel to documents)
            documents: Document text strings to index
        """
        if BM25Okapi is None:
            print("Warning: rank_bm25 not installed. BM25 search disabled.")
            print("Install with: pip install rank_bm25")
            return

        if not ids or not documents:
            print("Warning: No documents to build BM25 index from.")
            return

        self._ids = list(ids)
        self._documents = list(documents)

        # Tokenize all documents
        tokenized = [_tokenize(doc) for doc in self._documents]

        self._bm25 = BM25Okapi(tokenized)
        self._ready = True
        print(f"BM25 index built with {len(self._ids)} documents")

    def search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Search the BM25 index.

        Args:
            query: Natural language query string
            top_k: Number of results to return

        Returns:
            List of dicts with 'id', 'score', and 'rank' keys.
            Scores are raw BM25 scores (higher = better match).
        """
        if not self._ready or self._bm25 is None:
            return []

        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        scores = self._bm25.get_scores(query_tokens)

        # Get top_k indices sorted by score descending
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]

        results = []
        for rank, idx in enumerate(top_indices):
            if scores[idx] > 0:  # Only include documents with non-zero score
                results.append({
                    'id': self._ids[idx],
                    'score': float(scores[idx]),
                    'rank': rank + 1,
                })

        return results
