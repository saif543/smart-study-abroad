"""
Vector Store Module - ChromaDB wrapper for storing and searching embeddings

WHAT THIS DOES:
---------------
Stores university vectors in a special database (ChromaDB) that can
find similar vectors extremely fast.

WHY WE NEED THIS:
-----------------
Regular databases search by exact text match:
  "Find universities where country = 'Canada'" ✓

But we want to search by MEANING:
  "Find universities similar to 'affordable tech programs'"

ChromaDB does this by comparing vectors (numbers).

HOW IT WORKS:
-------------
1. Store each university as a vector (384 numbers)
2. When user searches, convert their query to a vector
3. Find the vectors closest to the query vector
4. Return those universities = best matches!

KEY CONCEPT - COSINE SIMILARITY:
--------------------------------
Measures how similar two vectors are (0 to 1):
- 1.0 = Identical meaning
- 0.7+ = Very similar
- 0.5 = Somewhat related
- 0.0 = Completely different
"""

import chromadb
from chromadb.config import Settings
import json
import os
import re
from typing import List, Dict, Any, Optional
import numpy as np


def parse_number(value, default=0):
    """Parse a number from various string formats."""
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # Remove common suffixes and characters
        cleaned = re.sub(r'[/$,+]', '', value)  # Remove $, /, commas, +
        cleaned = re.sub(r'(per\s*)?year.*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'[a-zA-Z].*', '', cleaned)  # Remove any trailing text
        cleaned = cleaned.strip()
        if cleaned:
            try:
                return float(cleaned)
            except ValueError:
                return default
    return default


def parse_english_requirements(value):
    """Parse English requirements from string like 'TOEFL 100 / IELTS 7.0'."""
    result = {'TOEFL': 0, 'IELTS': 0}
    if not value:
        return result

    if isinstance(value, dict):
        result['TOEFL'] = parse_number(value.get('TOEFL', 0))
        result['IELTS'] = parse_number(value.get('IELTS', 0))
    elif isinstance(value, str):
        toefl_match = re.search(r'TOEFL\s*(\d+)', value, re.IGNORECASE)
        ielts_match = re.search(r'IELTS\s*([\d.]+)', value, re.IGNORECASE)
        if toefl_match:
            result['TOEFL'] = float(toefl_match.group(1))
        if ielts_match:
            result['IELTS'] = float(ielts_match.group(1))

    return result


class VectorStore:
    """
    Manages ChromaDB for storing and searching university embeddings.

    ChromaDB stores data locally in a folder - no server needed!
    Works offline, persists across restarts.

    Example:
        store = VectorStore()
        store.add_university({"university": "MIT", ...}, [0.1, 0.2, ...])
        results = store.search([0.15, 0.18, ...], top_k=3)
    """

    def __init__(self, persist_directory: str = None):
        """
        Initialize ChromaDB connection.

        Args:
            persist_directory: Where to store the database files
                             Default: backend/rag/chroma_db/

        WHAT HAPPENS:
        - Creates a folder to store vector data
        - Data persists even after program closes
        - No external database server needed!
        """
        # Set default path if not provided
        if persist_directory is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            # Prefer unified database (ML-enriched, 26 fields) > fresh > default
            unified = os.path.join(current_dir, "chroma_db_unified")
            fresh = os.path.join(current_dir, "chroma_db_fresh")
            default = os.path.join(current_dir, "chroma_db")
            if os.path.isdir(unified):
                persist_directory = unified
            elif os.path.isdir(fresh):
                persist_directory = fresh
            else:
                persist_directory = default

        # Normalize path to ensure proper handling on Windows
        persist_directory = os.path.normpath(persist_directory)
        persist_directory = os.path.abspath(persist_directory)

        print(f"Initializing ChromaDB at: {persist_directory}")

        # Create ChromaDB client with persistence
        # This saves data to disk so it survives program restarts
        try:
            self.client = chromadb.PersistentClient(path=persist_directory)
        except Exception as e:
            print(f"ERROR: Failed to initialize ChromaDB client at {persist_directory}: {e}")
            raise

        # Get or create our collection (like a "table" in regular databases)
        # We call it "universities" to store university vectors
        collection_created = False
        try:
            # Try to get existing collection first
            self.collection = self.client.get_collection(
                name="universities"
            )
            # Verify the collection is accessible by trying to get count
            count = self.collection.count()
            print(f"Found existing collection. Current count: {count}")
            collection_created = True
        except Exception as e:
            # If collection doesn't exist or is corrupted, create it fresh
            print(f"Existing collection not accessible: {e}")
            print("Creating new collection...")
            try:
                # Try to delete first if it exists in a bad state
                try:
                    self.client.delete_collection("universities")
                except:
                    pass
                # Create fresh collection
                self.collection = self.client.create_collection(
                    name="universities",
                    metadata={"description": "University embeddings for RAG search", "hnsw:space": "cosine"}
                )
                print(f"Collection 'universities' created successfully")
                collection_created = True
            except Exception as creation_error:
                print(f"ERROR: Failed to create collection: {creation_error}")
                raise

    def add_university(self, university_data: dict, embedding: np.ndarray, doc_id: str = None) -> str:
        """
        Add a single university to the vector store.

        Args:
            university_data: Dictionary with university info
            embedding: 384-dimensional vector from Embedder
            doc_id: Unique ID (auto-generated if not provided)

        Returns:
            The document ID used

        WHAT'S STORED:
        - ID: Unique identifier
        - Embedding: The 384 numbers (for similarity search)
        - Metadata: University details (for filtering and display)
        - Document: Text description (for reference)
        """
        # Generate ID if not provided
        if doc_id is None:
            # Create ID from university name (sanitized)
            name = university_data.get('university', 'unknown')
            doc_id = name.lower().replace(' ', '_').replace('.', '')[:50]

        # Prepare metadata (ChromaDB stores this alongside vectors)
        # We store key fields so we can filter and display results
        metadata = {
            'university': university_data.get('university', ''),
            'country': university_data.get('country', ''),
            'degree': university_data.get('degree', ''),
            'field': university_data.get('field', ''),
            'tuition_fees': university_data.get('tuition_fees', 0),
            'gpa_requirement': university_data.get('gpa_requirement', 0),
        }

        # Create a text document (human-readable summary)
        document = f"{metadata['university']} - {metadata['degree']} in {metadata['field']} ({metadata['country']})"

        # Add to ChromaDB
        self.collection.add(
            ids=[doc_id],
            embeddings=[embedding.tolist()],  # Convert numpy to list
            metadatas=[metadata],
            documents=[document]
        )

        return doc_id

    def add_universities_batch(self, universities: List[dict], embeddings: np.ndarray) -> int:
        """
        Add multiple universities at once (much faster than one-by-one).

        Args:
            universities: List of university dictionaries
            embeddings: Array of embeddings, shape (N, 384)

        Returns:
            Number of universities added

        WHY BATCH?
        - Adding 100 universities one-by-one: ~10 seconds
        - Adding 100 universities in batch: ~1 second
        """
        ids = []
        metadatas = []
        documents = []

        for i, uni in enumerate(universities):
            # Generate unique ID
            name = uni.get('university', f'uni_{i}')
            doc_id = f"{name.lower().replace(' ', '_').replace('.', '')[:40]}_{i}"
            ids.append(doc_id)

            # Prepare metadata using parse_number helper
            eng_req = parse_english_requirements(uni.get('english_requirements', ''))

            metadata = {
                'university': uni.get('university', ''),
                'country': uni.get('country', ''),
                'degree': uni.get('degree', ''),
                'field': uni.get('field', ''),
                'tuition_fees': parse_number(uni.get('tuition_fees', 0)),
                'gpa_requirement': parse_number(uni.get('gpa_requirement', 0)),
                'ielts': eng_req['IELTS'],
                'toefl': eng_req['TOEFL'],
                'scholarships': uni.get('scholarships', ''),
            }
            # Store ALL extra fields from the JSON so the frontend can display them
            extra_fields = ['deadline_fall', 'deadline_spring', 'deadline_summer',
                           'english_requirements', 'test_requirements', 'program_duration', 'qs_ranking']
            for ef in extra_fields:
                val = uni.get(ef, '')
                if val:
                    metadata[ef] = str(val)
            metadatas.append(metadata)

            # Create enriched document text (improves BM25 keyword recall)
            parts = [
                metadata['university'],
                uni.get('degree', ''),
                uni.get('field', ''),
                metadata['country'],
            ]
            tuition = metadata['tuition_fees']
            if tuition:
                parts.append(f"tuition ${tuition:,.0f}" if isinstance(tuition, (int, float)) else f"tuition {tuition}")
            gpa = metadata['gpa_requirement']
            if gpa:
                parts.append(f"GPA {gpa}")
            scholarships = uni.get('scholarships', '')
            if scholarships:
                parts.append(f"scholarships: {scholarships}")
            doc = " | ".join(p for p in parts if p)
            documents.append(doc)

        # Batch add to ChromaDB
        self.collection.add(
            ids=ids,
            embeddings=embeddings.tolist(),
            metadatas=metadatas,
            documents=documents
        )

        print(f"Added {len(ids)} universities to vector store")
        return len(ids)

    def search(self, query_embedding: np.ndarray, top_k: int = 5, filters: dict = None) -> List[Dict[str, Any]]:
        """
        Find universities most similar to a query.

        Args:
            query_embedding: 384-dimensional vector of user's query
            top_k: How many results to return (default: 5)
            filters: Optional filters like {"country": "Canada"}

        Returns:
            List of dictionaries with:
            - university data (metadata)
            - similarity score (0 to 1, higher = better match)
            - distance (lower = better match)

        HOW SEARCH WORKS:
        1. Take the query vector
        2. Compare with ALL stored university vectors
        3. Return the top_k closest ones
        4. This happens in milliseconds thanks to ChromaDB's indexing!
        """
        # Build where clause for filtering
        where_clause = None
        if filters:
            where_clause = {}
            if filters.get('country'):
                where_clause['country'] = filters['country']
            if filters.get('degree'):
                where_clause['degree'] = filters['degree']

        # Query ChromaDB
        results = self.collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=top_k,
            where=where_clause if where_clause else None,
            include=['metadatas', 'documents', 'distances']
        )

        # Format results
        formatted_results = []
        if results and results['ids'] and results['ids'][0]:
            for i in range(len(results['ids'][0])):
                # ChromaDB returns cosine distance (0-2 range), convert to similarity
                # Lower distance = more similar
                distance = results['distances'][0][i]
                # Convert cosine distance to similarity (0-1 scale)
                similarity = 1.0 - (distance / 2.0)

                formatted_results.append({
                    'id': results['ids'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'document': results['documents'][0][i],
                    'distance': distance,
                    'similarity': similarity
                })

        return formatted_results

    def get_all_documents(self) -> Dict[str, Any]:
        """
        Return all stored IDs, documents, and metadatas.
        Used by BM25 index to build a keyword search index.
        """
        results = self.collection.get(include=['documents', 'metadatas'])
        return {
            'ids': results['ids'],
            'documents': results['documents'],
            'metadatas': results['metadatas'],
        }

    def clear_all(self):
        """
        Remove all universities from the store.
        Useful when re-importing data.
        """
        # Delete and recreate the collection
        try:
            self.client.delete_collection("universities")
        except Exception as e:
            print(f"Note: Could not delete collection (may not exist): {e}")

        # Create a fresh collection
        self.collection = self.client.create_collection(
            name="universities",
            metadata={"description": "University embeddings for RAG search", "hnsw:space": "cosine"}
        )
        print("Vector store cleared!")

    def get_count(self) -> int:
        """Get total number of universities stored."""
        return self.collection.count()

    def get_all_countries(self) -> List[str]:
        """Get list of all unique countries in the store."""
        # Query all items (just metadata)
        results = self.collection.get(include=['metadatas'])
        countries = set()
        for meta in results['metadatas']:
            if meta.get('country'):
                countries.add(meta['country'])
        return sorted(list(countries))


# Quick test when running this file directly
if __name__ == "__main__":
    import numpy as np

    print("Testing VectorStore...")

    # Create store
    store = VectorStore()

    # Clear for fresh test
    store.clear_all()

    # Add some test data
    test_universities = [
        {"university": "MIT", "country": "USA", "degree": "Masters", "field": "Computer Science", "tuition_fees": 55000, "gpa_requirement": 3.8},
        {"university": "University of Toronto", "country": "Canada", "degree": "Masters", "field": "Data Science", "tuition_fees": 25000, "gpa_requirement": 3.5},
        {"university": "TU Munich", "country": "Germany", "degree": "Masters", "field": "Engineering", "tuition_fees": 500, "gpa_requirement": 3.0},
    ]

    # Create fake embeddings for testing (normally from Embedder)
    fake_embeddings = np.random.rand(3, 384).astype(np.float32)

    # Add to store
    store.add_universities_batch(test_universities, fake_embeddings)

    print(f"\nTotal universities in store: {store.get_count()}")
    print(f"Countries available: {store.get_all_countries()}")

    # Test search
    query_embedding = np.random.rand(384).astype(np.float32)
    results = store.search(query_embedding, top_k=2)

    print(f"\nSearch results:")
    for r in results:
        print(f"  - {r['metadata']['university']}: similarity={r['similarity']:.3f}")
