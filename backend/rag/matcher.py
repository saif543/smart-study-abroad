"""
University Matcher Module - Calculates match percentages

WHAT THIS DOES:
---------------
Combines semantic search (meaning similarity) with practical criteria
(budget, GPA, etc.) to find the BEST matching universities.

WHY BOTH SEMANTIC AND CRITERIA?
-------------------------------
Semantic alone: "I want computer science" → finds CS programs
    But... might return $80,000/year program to someone with $20,000 budget

Criteria alone: "budget < $30,000" → finds affordable programs
    But... might miss great programs named differently

COMBINED: Best of both worlds!
    Finds programs that MEAN what you want AND FIT your situation

MATCH PERCENTAGE FORMULA:
-------------------------
Final Score = (Semantic Score × 40%) + (Criteria Score × 60%)

Criteria Score breakdown:
- Budget fit:   25% (tuition <= budget = full points)
- GPA fit:      20% (your GPA >= required = full points)
- Field match:  15% (exact field match = full points)

Example:
- MIT CS: Semantic=0.9, but Budget=0.3 (too expensive) → 54%
- UToronto CS: Semantic=0.85, Budget=1.0, GPA=1.0 → 85%
"""

from typing import List, Dict, Any, Optional
import numpy as np
from .embedder import Embedder
from .vector_store import VectorStore


class UniversityMatcher:
    """
    Main class for finding best-matching universities.

    Combines:
    1. ChromaDB vector search (semantic similarity)
    2. Practical criteria matching (budget, GPA, etc.)

    Example:
        matcher = UniversityMatcher()
        results = matcher.find_matches({
            'field': 'Computer Science',
            'degree': 'Masters',
            'country': 'Canada',
            'budget': 30000,
            'gpa': 3.5
        }, top_k=3)
    """

    # Weights for final score calculation
    SEMANTIC_WEIGHT = 0.40   # 40% from meaning similarity
    CRITERIA_WEIGHT = 0.60   # 60% from practical criteria

    # Breakdown of criteria weights (must sum to 1.0)
    BUDGET_WEIGHT = 0.25     # 25% - Can you afford it?
    GPA_WEIGHT = 0.20        # 20% - Are you qualified?
    FIELD_WEIGHT = 0.15      # 15% - Exact field match?

    def __init__(self, embedder: Embedder = None, vector_store: VectorStore = None):
        """
        Initialize matcher with embedder and vector store.

        Args:
            embedder: Embedder instance (creates one if not provided)
            vector_store: VectorStore instance (creates one if not provided)
        """
        print("Initializing University Matcher...")

        # Create or use provided embedder
        self.embedder = embedder if embedder else Embedder()

        # Create or use provided vector store
        self.vector_store = vector_store if vector_store else VectorStore()

        print("Matcher ready!")

    def find_matches(self, preferences: Dict[str, Any], top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Find best matching universities for given preferences.

        Args:
            preferences: Dictionary with user preferences:
                - field: str, e.g., "Computer Science"
                - degree: str, e.g., "Masters"
                - country: str, e.g., "Canada" (optional)
                - budget: int, max tuition in USD
                - gpa: float, user's GPA (0-4 scale)
                - ielts: float, IELTS score (optional)
                - toefl: int, TOEFL score (optional)

            top_k: Number of results to return

        Returns:
            List of matched universities with:
            - university data
            - match_percentage (0-100)
            - breakdown of scores
        """
        print(f"\nFinding matches for: {preferences}")

        # Step 1: Create embedding from user preferences
        query_embedding = self.embedder.embed_user_query(preferences)

        # Step 2: Get more candidates than needed (we'll filter/re-rank)
        # Get extra to account for filtering
        candidates = self.vector_store.search(
            query_embedding,
            top_k=top_k * 3,  # Get 3x to have room for re-ranking
            filters={'country': preferences.get('country')} if preferences.get('country') else None
        )

        if not candidates:
            print("No candidates found in vector store")
            return []

        print(f"Found {len(candidates)} initial candidates")

        # Step 3: Calculate detailed match scores for each candidate
        scored_results = []
        for candidate in candidates:
            metadata = candidate['metadata']

            # Calculate criteria scores
            scores = self._calculate_criteria_scores(preferences, metadata)

            # Combine semantic and criteria scores
            semantic_score = candidate['similarity']
            criteria_score = scores['total_criteria']

            final_score = (
                semantic_score * self.SEMANTIC_WEIGHT +
                criteria_score * self.CRITERIA_WEIGHT
            )

            # Convert to percentage (0-100)
            match_percentage = round(final_score * 100, 1)

            scored_results.append({
                'university': metadata.get('university', 'Unknown'),
                'country': metadata.get('country', 'Unknown'),
                'degree': metadata.get('degree', ''),
                'field': metadata.get('field', ''),
                'tuition_fees': metadata.get('tuition_fees', 0),
                'gpa_requirement': metadata.get('gpa_requirement', 0),
                'match_percentage': match_percentage,
                'score_breakdown': {
                    'semantic_similarity': round(semantic_score * 100, 1),
                    'budget_fit': round(scores['budget'] * 100, 1),
                    'gpa_fit': round(scores['gpa'] * 100, 1),
                    'field_match': round(scores['field'] * 100, 1),
                },
                'reasons': self._generate_match_reasons(preferences, metadata, scores)
            })

        # Step 4: Sort by final score and return top_k
        scored_results.sort(key=lambda x: x['match_percentage'], reverse=True)

        return scored_results[:top_k]

    def _calculate_criteria_scores(self, preferences: Dict, university: Dict) -> Dict[str, float]:
        """
        Calculate individual criteria scores.

        Returns dict with scores for each criterion (0-1 scale).
        """
        scores = {}

        # BUDGET FIT (25%)
        # Score = 1.0 if affordable, decreases as tuition exceeds budget
        user_budget = preferences.get('budget', float('inf'))
        tuition = university.get('tuition_fees', 0)

        if tuition <= user_budget:
            scores['budget'] = 1.0  # Affordable = full score
        else:
            # Partial score based on how much over budget
            over_percentage = (tuition - user_budget) / user_budget
            scores['budget'] = max(0, 1.0 - over_percentage)

        # GPA FIT (20%)
        # Score = 1.0 if qualified, partial if close
        user_gpa = preferences.get('gpa', 4.0)
        required_gpa = university.get('gpa_requirement', 0)

        if user_gpa >= required_gpa:
            scores['gpa'] = 1.0  # Qualified = full score
        else:
            # Partial score based on how close they are
            gap = required_gpa - user_gpa
            scores['gpa'] = max(0, 1.0 - (gap / 0.5))  # Lose points for each 0.5 below

        # FIELD MATCH (15%)
        # Score based on how well fields match
        user_field = preferences.get('field', '').lower()
        uni_field = university.get('field', '').lower()

        if user_field and uni_field:
            # Exact match
            if user_field == uni_field:
                scores['field'] = 1.0
            # Partial match (one contains the other)
            elif user_field in uni_field or uni_field in user_field:
                scores['field'] = 0.8
            # Related fields (common keywords)
            elif self._fields_related(user_field, uni_field):
                scores['field'] = 0.6
            else:
                scores['field'] = 0.3  # Different field, base score
        else:
            scores['field'] = 0.5  # No field specified, neutral

        # Calculate weighted total criteria score
        scores['total_criteria'] = (
            scores['budget'] * (self.BUDGET_WEIGHT / self.CRITERIA_WEIGHT) +
            scores['gpa'] * (self.GPA_WEIGHT / self.CRITERIA_WEIGHT) +
            scores['field'] * (self.FIELD_WEIGHT / self.CRITERIA_WEIGHT)
        )

        return scores

    def _fields_related(self, field1: str, field2: str) -> bool:
        """Check if two fields are related."""
        # Define related field groups
        related_groups = [
            {'computer science', 'software engineering', 'data science', 'artificial intelligence', 'machine learning', 'information technology', 'cs', 'it'},
            {'business', 'mba', 'management', 'finance', 'marketing', 'economics'},
            {'engineering', 'mechanical', 'electrical', 'civil', 'chemical'},
            {'medicine', 'healthcare', 'nursing', 'public health', 'biomedical'},
            {'law', 'legal', 'international law'},
            {'arts', 'humanities', 'literature', 'history', 'philosophy'},
        ]

        for group in related_groups:
            # Check if both fields have keywords from the same group
            f1_matches = any(keyword in field1 for keyword in group)
            f2_matches = any(keyword in field2 for keyword in group)
            if f1_matches and f2_matches:
                return True

        return False

    def _generate_match_reasons(self, preferences: Dict, university: Dict, scores: Dict) -> List[str]:
        """Generate human-readable reasons for the match."""
        reasons = []

        # Budget reason
        if scores['budget'] >= 1.0:
            reasons.append(f"Within your budget of ${preferences.get('budget', 0):,}")
        elif scores['budget'] >= 0.7:
            reasons.append(f"Slightly over budget (${university.get('tuition_fees', 0):,})")
        else:
            reasons.append(f"Over budget (${university.get('tuition_fees', 0):,} vs ${preferences.get('budget', 0):,} budget)")

        # GPA reason
        if scores['gpa'] >= 1.0:
            reasons.append(f"You meet the GPA requirement ({university.get('gpa_requirement', 0)})")
        else:
            reasons.append(f"GPA requirement is {university.get('gpa_requirement', 0)} (yours: {preferences.get('gpa', 0)})")

        # Field reason
        if scores['field'] >= 0.9:
            reasons.append("Exact field match")
        elif scores['field'] >= 0.7:
            reasons.append("Related field of study")

        return reasons


def load_universities_to_vectorstore(json_path: str, embedder: Embedder = None, vector_store: VectorStore = None):
    """
    Utility function to load universities from JSON into ChromaDB.

    This is the "sync" step that imports your university data into the
    vector database for searching.

    Args:
        json_path: Path to universities_data.json
        embedder: Embedder instance (optional)
        vector_store: VectorStore instance (optional)

    Returns:
        Number of universities loaded
    """
    import json

    print(f"\nLoading universities from: {json_path}")

    # Initialize components
    if embedder is None:
        embedder = Embedder()
    if vector_store is None:
        vector_store = VectorStore()

    # Clear existing data for fresh import
    vector_store.clear_all()

    # Load JSON data
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Handle both formats: direct list or {universities: [...]}
    if isinstance(data, list):
        universities = data
    else:
        universities = data.get('universities', [])
    print(f"Found {len(universities)} universities in JSON")

    # Create embeddings for all universities
    print("Creating embeddings (this may take a minute on first run)...")

    all_embeddings = []
    for uni in universities:
        embedding = embedder.embed_university(uni)
        all_embeddings.append(embedding)

    embeddings_array = np.array(all_embeddings)
    print(f"Created {len(all_embeddings)} embeddings")

    # Add to vector store
    count = vector_store.add_universities_batch(universities, embeddings_array)

    print(f"\nSuccessfully loaded {count} universities into vector store!")
    return count


# Quick test when running directly
if __name__ == "__main__":
    import os

    print("=" * 60)
    print("UNIVERSITY MATCHER TEST")
    print("=" * 60)

    # Check if we have data
    json_path = os.path.join(os.path.dirname(__file__), '..', 'universities_data.json')

    if os.path.exists(json_path):
        # Load data into vector store
        load_universities_to_vectorstore(json_path)

        # Create matcher
        matcher = UniversityMatcher()

        # Test search
        test_preferences = {
            'field': 'Computer Science',
            'degree': 'Masters',
            'country': 'Canada',
            'budget': 35000,
            'gpa': 3.5
        }

        print(f"\n{'='*60}")
        print("SEARCH TEST")
        print(f"Preferences: {test_preferences}")
        print("="*60)

        results = matcher.find_matches(test_preferences, top_k=3)

        for i, result in enumerate(results, 1):
            print(f"\n#{i}: {result['university']}")
            print(f"    Match: {result['match_percentage']}%")
            print(f"    Country: {result['country']}")
            print(f"    Field: {result['field']}")
            print(f"    Tuition: ${result['tuition_fees']:,}")
            print(f"    GPA Required: {result['gpa_requirement']}")
            print(f"    Breakdown:")
            for key, value in result['score_breakdown'].items():
                print(f"      - {key}: {value}%")
            print(f"    Reasons: {', '.join(result['reasons'])}")
    else:
        print(f"universities_data.json not found at: {json_path}")
        print("Please create the data file first.")
