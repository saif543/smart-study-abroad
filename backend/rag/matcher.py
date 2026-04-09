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

SEARCH PIPELINE:
----------------
1. Vector search (ChromaDB cosine) + BM25 keyword search
2. Reciprocal Rank Fusion (merges both result lists)
3. Cross-encoder re-ranking (smart re-ordering)
4. Criteria scoring (budget, GPA, field, English, scholarships)

MATCH PERCENTAGE FORMULA:
-------------------------
Final Score = (Semantic × 35%) + (Re-rank × 5%) + (Criteria × 60%)

Criteria Score breakdown:
- Budget fit:       20% (tuition <= budget = full points)
- GPA fit:          15% (your GPA >= required = full points)
- Field match:      10% (exact field match = full points)
- English fit:      10% (your IELTS/TOEFL >= required = full points)
- Scholarship:       5% (scholarship available = full points)
"""

from typing import List, Dict, Any, Optional
import numpy as np
from .embedder import Embedder
from .vector_store import VectorStore
from .bm25_search import BM25Index
from .reranker import Reranker


class UniversityMatcher:
    """
    Main class for finding best-matching universities.

    Combines:
    1. ChromaDB vector search (cosine similarity)
    2. BM25 keyword search (exact term matching)
    3. Reciprocal Rank Fusion (merges vector + BM25)
    4. Cross-encoder re-ranking (smart re-ordering)
    5. Practical criteria matching (budget, GPA, etc.)

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
    SEMANTIC_WEIGHT = 0.30   # 30% from meaning similarity (vector + BM25 fused)
    RERANK_WEIGHT = 0.05     # 5% from cross-encoder re-ranking confidence
    CRITERIA_WEIGHT = 0.65   # 65% from practical criteria (increased — we have richer data now)

    # Breakdown of criteria weights (must sum to CRITERIA_WEIGHT = 0.65)
    BUDGET_WEIGHT = 0.12     # 12% - Total cost fit (tuition + living)
    GPA_WEIGHT = 0.10        # 10% - Are you qualified?
    FIELD_WEIGHT = 0.08      # 8% - Exact field match?
    ENGLISH_WEIGHT = 0.05    # 5% - Do you meet English requirements?
    SCHOLARSHIP_WEIGHT = 0.05  # 5% - Scholarships available? (uses max_coverage_percent)
    QS_RANKING_WEIGHT = 0.10  # 10% - QS World University Ranking
    ACCEPTANCE_WEIGHT = 0.08  # 8% - Realistic admission chance based on acceptance rate
    WORK_VISA_WEIGHT = 0.04  # 4% - Work visa availability for international students
    RESEARCH_WEIGHT = 0.03   # 3% - Research fit for the student

    def __init__(self, embedder: Embedder = None, vector_store: VectorStore = None):
        """
        Initialize matcher with embedder, vector store, BM25, and reranker.

        Args:
            embedder: Embedder instance (creates one if not provided)
            vector_store: VectorStore instance (creates one if not provided)
        """
        print("Initializing University Matcher...")

        # Create or use provided embedder
        self.embedder = embedder if embedder else Embedder()

        # Create or use provided vector store
        self.vector_store = vector_store if vector_store else VectorStore()

        # Initialize BM25 index from existing vector store data
        self.bm25_index = BM25Index()
        self._rebuild_bm25_index()

        # Initialize cross-encoder re-ranker
        self.reranker = Reranker()

        print("Matcher ready!")

    def find_matches(self, preferences: Dict[str, Any], top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Find best matching universities for given preferences.

        Pipeline:
        1. Vector search (ChromaDB cosine) + BM25 keyword search
        2. Reciprocal Rank Fusion (merge both result lists)
        3. Cross-encoder re-ranking (smart re-ordering)
        4. Criteria scoring (budget, GPA, field) → final score

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

        fetch_k = max(top_k * 5, 30)  # Get more candidates for re-ranking

        # --- Step 1: Vector search (ChromaDB cosine) ---
        query_embedding = self.embedder.embed_user_query(preferences)
        vector_candidates = self.vector_store.search(
            query_embedding,
            top_k=fetch_k,
            filters={'country': preferences.get('country')} if preferences.get('country') else None
        )
        print(f"Vector search returned {len(vector_candidates)} candidates")

        # --- Step 2: BM25 keyword search ---
        query_text = self._build_query_text(preferences)
        bm25_results = self.bm25_index.search(query_text, top_k=fetch_k) if self.bm25_index.is_ready else []
        print(f"BM25 search returned {len(bm25_results)} candidates")

        # --- Step 3: Reciprocal Rank Fusion ---
        # Build ID→candidate lookup from vector results
        vector_lookup = {c['id']: c for c in vector_candidates}
        fused_ids = self._reciprocal_rank_fusion(
            vector_ids=[c['id'] for c in vector_candidates],
            bm25_ids=[r['id'] for r in bm25_results],
        )
        print(f"RRF fused to {len(fused_ids)} unique candidates")

        # Collect full candidate data for fused IDs (vector results have metadata)
        # For IDs that came only from BM25, we need to fetch their data
        all_store_data = None
        fused_candidates = []
        for fid in fused_ids:
            if fid in vector_lookup:
                fused_candidates.append(vector_lookup[fid])
            else:
                # This ID came only from BM25; fetch its data from the store
                if all_store_data is None:
                    all_store_data = self.vector_store.get_all_documents()
                    all_store_lookup = {}
                    for idx, sid in enumerate(all_store_data['ids']):
                        all_store_lookup[sid] = {
                            'id': sid,
                            'metadata': all_store_data['metadatas'][idx],
                            'document': all_store_data['documents'][idx],
                            'distance': 1.0,
                            'similarity': 0.5,  # neutral default for BM25-only results
                        }
                if fid in all_store_lookup:
                    fused_candidates.append(all_store_lookup[fid])

        if not fused_candidates:
            print("No candidates found after fusion")
            return []

        # --- Step 4: Cross-encoder re-ranking ---
        reranked = self.reranker.rerank(query_text, fused_candidates, top_k=fetch_k)
        print(f"Re-ranked {len(reranked)} candidates")

        # --- Step 5: Criteria scoring + final score ---
        scored_results = []
        for candidate in reranked:
            metadata = candidate['metadata']

            # Calculate criteria scores
            scores = self._calculate_criteria_scores(preferences, metadata)

            # Combine semantic, re-rank, and criteria scores
            semantic_score = candidate['similarity']
            rerank_score = candidate.get('rerank_score', 0.5)
            criteria_score = scores['total_criteria']

            final_score = (
                semantic_score * self.SEMANTIC_WEIGHT +
                rerank_score * self.RERANK_WEIGHT +
                criteria_score * self.CRITERIA_WEIGHT
            )

            # Apply hard penalty for over-budget universities (tuition only)
            user_budget = preferences.get('budget', 0)
            tuition = metadata.get('tuition_fees', 0)
            if user_budget and tuition and tuition > user_budget:
                over_ratio = tuition / user_budget
                if over_ratio > 2.0:
                    final_score *= 0.3  # 70% penalty if more than 2x over budget
                elif over_ratio > 1.5:
                    final_score *= 0.5  # 50% penalty if more than 1.5x over
                elif over_ratio > 1.2:
                    final_score *= 0.7  # 30% penalty if more than 20% over
                else:
                    final_score *= 0.85  # 15% penalty if slightly over

            # Convert to percentage (0-100)
            match_percentage = round(final_score * 100, 1)

            scored_results.append({
                'university': metadata.get('university', 'Unknown'),
                'country': metadata.get('country', 'Unknown'),
                'degree': metadata.get('degree', ''),
                'field': metadata.get('field', ''),
                'tuition_fees': metadata.get('tuition_fees', 0),
                'gpa_requirement': metadata.get('gpa_requirement', 0),
                'ielts': metadata.get('ielts', 0),
                'toefl': metadata.get('toefl', 0),
                'scholarships': metadata.get('scholarships', ''),
                'deadline_fall': metadata.get('deadline_fall', ''),
                'deadline_spring': metadata.get('deadline_spring', ''),
                'test_requirements': metadata.get('test_requirements', ''),
                'program_duration': metadata.get('program_duration', ''),
                'english_requirements': metadata.get('english_requirements', ''),
                'qs_ranking': metadata.get('qs_ranking', ''),
                # New unified fields from ML dataset
                'acceptance_rate': metadata.get('acceptance_rate', 0),
                'living_cost': metadata.get('living_cost', 0),
                'total_cost_estimated': metadata.get('total_cost_estimated', 0),
                'scholarship_available': metadata.get('scholarship_available', 0),
                'max_coverage_percent': metadata.get('max_coverage_percent', 0),
                'work_visa_available': metadata.get('work_visa_available', 0),
                'research_weight': metadata.get('research_weight', 0),
                'eca_weight': metadata.get('eca_weight', 0),
                'research_focus': metadata.get('research_focus', ''),
                'programs_offered': metadata.get('programs_offered', ''),
                'min_gre': metadata.get('min_gre', 0),
                'match_percentage': match_percentage,
                'score_breakdown': {
                    'semantic_similarity': round(semantic_score * 100, 1),
                    'rerank_confidence': round(rerank_score * 100, 1),
                    'budget_fit': round(scores['budget'] * 100, 1),
                    'gpa_fit': round(scores['gpa'] * 100, 1),
                    'field_match': round(scores['field'] * 100, 1),
                    'english_fit': round(scores['english'] * 100, 1),
                    'scholarship_fit': round(scores['scholarship'] * 100, 1),
                    'qs_ranking_score': round(scores['qs_ranking'] * 100, 1),
                    'acceptance_score': round(scores['acceptance'] * 100, 1),
                    'work_visa_score': round(scores['work_visa'] * 100, 1),
                    'research_score': round(scores['research'] * 100, 1),
                },
                'reasons': self._generate_match_reasons(preferences, metadata, scores)
            })

        # Step 6: Sort by final score and return top_k
        scored_results.sort(key=lambda x: x['match_percentage'], reverse=True)

        return scored_results[:top_k]

    def _rebuild_bm25_index(self):
        """Build (or rebuild) the BM25 index from current vector store contents."""
        if self.vector_store.get_count() == 0:
            print("Vector store is empty — skipping BM25 index build")
            return
        data = self.vector_store.get_all_documents()
        self.bm25_index.build_index(data['ids'], data['documents'])

    @staticmethod
    def _build_query_text(preferences: Dict[str, Any]) -> str:
        """Convert user preferences dict into a search query string.

        If the user provided a free-text description, use it as the primary
        query (natural language works better for vector search, BM25, and
        cross-encoder). Structured fields are appended to enrich the query.
        """
        free_text = (preferences.get('free_text') or '').strip()
        parts = []
        if free_text:
            parts.append(free_text)
        if preferences.get('field'):
            parts.append(preferences['field'])
        if preferences.get('degree'):
            parts.append(preferences['degree'])
        if preferences.get('country'):
            parts.append(preferences['country'])
        if preferences.get('university'):
            parts.append(preferences['university'])
        return " ".join(parts) if parts else "university"

    @staticmethod
    def _reciprocal_rank_fusion(
        vector_ids: List[str],
        bm25_ids: List[str],
        k: int = 60,
    ) -> List[str]:
        """
        Merge two ranked ID lists using Reciprocal Rank Fusion (RRF).

        RRF score for document d = sum over lists L of  1 / (k + rank_L(d))
        Higher RRF score = better combined ranking.

        Args:
            vector_ids: Ranked IDs from vector search (best first)
            bm25_ids: Ranked IDs from BM25 search (best first)
            k: Smoothing constant (default 60, standard value)

        Returns:
            Merged list of IDs sorted by RRF score descending.
        """
        rrf_scores: Dict[str, float] = {}

        for rank, doc_id in enumerate(vector_ids, start=1):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (k + rank)

        for rank, doc_id in enumerate(bm25_ids, start=1):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (k + rank)

        # Sort by RRF score descending
        sorted_ids = sorted(rrf_scores.keys(), key=lambda d: rrf_scores[d], reverse=True)
        return sorted_ids

    def _calculate_criteria_scores(self, preferences: Dict, university: Dict) -> Dict[str, float]:
        """
        Calculate individual criteria scores.

        Returns dict with scores for each criterion (0-1 scale).
        """
        scores = {}

        # BUDGET FIT — compares against tuition (what users mean by "budget")
        # Total cost (tuition + living) is shown separately as info
        user_budget = preferences.get('budget', 0)
        tuition = university.get('tuition_fees', 0)
        cost_to_compare = tuition if tuition else 0
        free_text = (preferences.get('free_text') or '').lower()

        # Detect budget intent from free text
        budget_intent = 'neutral'  # 'cheap', 'expensive', or 'neutral'
        cheap_keywords = ['affordable', 'cheap', 'low cost', 'low tuition', 'budget', 'inexpensive', 'economical']
        expensive_keywords = ['expensive', 'premium', 'higher cost', 'high cost', 'top tier', 'prestigious', 'elite']
        if any(kw in free_text for kw in cheap_keywords):
            budget_intent = 'cheap'
        elif any(kw in free_text for kw in expensive_keywords):
            budget_intent = 'expensive'

        if not user_budget and budget_intent == 'cheap':
            # User wants affordable — lower total cost = higher score
            if cost_to_compare <= 15000:
                scores['budget'] = 1.0
            elif cost_to_compare <= 25000:
                scores['budget'] = 0.9
            elif cost_to_compare <= 40000:
                scores['budget'] = 0.7
            elif cost_to_compare <= 55000:
                scores['budget'] = 0.4
            elif cost_to_compare <= 70000:
                scores['budget'] = 0.15
            else:
                scores['budget'] = 0.0
        elif not user_budget and budget_intent == 'expensive':
            # User wants premium/expensive — higher cost = higher score
            if cost_to_compare >= 80000:
                scores['budget'] = 1.0
            elif cost_to_compare >= 60000:
                scores['budget'] = 0.8
            elif cost_to_compare >= 40000:
                scores['budget'] = 0.5
            elif cost_to_compare >= 25000:
                scores['budget'] = 0.3
            else:
                scores['budget'] = 0.1
        elif not user_budget:
            # No budget specified, no intent — neutral score
            scores['budget'] = 0.5
        elif cost_to_compare <= user_budget:
            scores['budget'] = 1.0  # Affordable = full score
        else:
            # Penalize for going over budget (gradual)
            over_percentage = (cost_to_compare - user_budget) / user_budget
            scores['budget'] = max(0, 1.0 - (over_percentage * 2))

        # GPA FIT (15%)
        # Score = 1.0 if qualified, partial if close
        user_gpa = preferences.get('gpa', 0)
        required_gpa = university.get('gpa_requirement', 0)

        if not user_gpa:
            # No GPA specified — neutral score
            scores['gpa'] = 0.5
        elif user_gpa >= required_gpa:
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

        # ENGLISH REQUIREMENTS FIT (10%)
        # Score = 1.0 if your score meets or exceeds the requirement
        user_english_test = preferences.get('english_test', '').upper()  # 'TOEFL' or 'IELTS'
        user_english_score = preferences.get('english_score', 0)
        if isinstance(user_english_score, str):
            try:
                user_english_score = float(user_english_score) if user_english_score else 0
            except ValueError:
                user_english_score = 0

        required_ielts = university.get('ielts', 0) or 0
        required_toefl = university.get('toefl', 0) or 0

        if isinstance(required_ielts, str):
            try:
                required_ielts = float(required_ielts)
            except ValueError:
                required_ielts = 0
        if isinstance(required_toefl, str):
            try:
                required_toefl = float(required_toefl)
            except ValueError:
                required_toefl = 0

        if not user_english_score or not user_english_test:
            # No English score provided by user — neutral score
            scores['english'] = 0.5
        elif user_english_test == 'IELTS' and required_ielts:
            if user_english_score >= required_ielts:
                scores['english'] = 1.0
            else:
                gap = required_ielts - user_english_score
                scores['english'] = max(0, 1.0 - (gap / 1.5))  # Lose points per 1.5 below
        elif user_english_test == 'TOEFL' and required_toefl:
            if user_english_score >= required_toefl:
                scores['english'] = 1.0
            else:
                gap = required_toefl - user_english_score
                scores['english'] = max(0, 1.0 - (gap / 20))  # Lose points per 20 below
        else:
            # User provided a score but university has no requirement for that test
            scores['english'] = 0.7  # Slight positive — likely still qualifies

        # SCHOLARSHIP AVAILABILITY (5%) — uses max_coverage_percent when available
        user_wants_scholarship = preferences.get('prefer_scholarship', False)
        scholarship_info = str(university.get('scholarships', '')).lower()
        max_coverage = university.get('max_coverage_percent', 0) or 0
        if isinstance(max_coverage, str):
            try:
                max_coverage = float(max_coverage)
            except (ValueError, TypeError):
                max_coverage = 0

        has_scholarship = bool(scholarship_info and scholarship_info not in ('', 'none', 'n/a', 'not available', 'no'))

        if not user_wants_scholarship:
            # User doesn't care — neutral
            scores['scholarship'] = 0.5
        elif max_coverage > 0:
            # Use actual coverage percentage for precise scoring
            if max_coverage >= 100:
                scores['scholarship'] = 1.0   # Full funding
            elif max_coverage >= 75:
                scores['scholarship'] = 0.9
            elif max_coverage >= 50:
                scores['scholarship'] = 0.75
            elif max_coverage >= 25:
                scores['scholarship'] = 0.6
            else:
                scores['scholarship'] = 0.4
        elif has_scholarship:
            # Fallback to text-based scoring
            if 'full' in scholarship_info:
                scores['scholarship'] = 1.0
            elif 'merit' in scholarship_info or 'available' in scholarship_info:
                scores['scholarship'] = 0.85
            elif 'limited' in scholarship_info or 'partial' in scholarship_info:
                scores['scholarship'] = 0.6
            else:
                scores['scholarship'] = 0.7
        else:
            # User wants scholarships but none available
            scores['scholarship'] = 0.1

        # QS RANKING (15%)
        # Higher-ranked universities get higher scores
        qs_ranking = university.get('qs_ranking', 260)
        try:
            qs_ranking = int(qs_ranking) if qs_ranking else 260
        except (ValueError, TypeError):
            qs_ranking = 260

        if qs_ranking <= 10:
            scores['qs_ranking'] = 1.0
        elif qs_ranking <= 25:
            scores['qs_ranking'] = 0.9
        elif qs_ranking <= 50:
            scores['qs_ranking'] = 0.8
        elif qs_ranking <= 100:
            scores['qs_ranking'] = 0.65
        elif qs_ranking <= 150:
            scores['qs_ranking'] = 0.5
        elif qs_ranking <= 200:
            scores['qs_ranking'] = 0.35
        else:
            scores['qs_ranking'] = 0.2

        # ACCEPTANCE RATE (8%) — realistic admission chances
        acceptance_rate = university.get('acceptance_rate', 0) or 0
        if isinstance(acceptance_rate, str):
            try:
                acceptance_rate = float(acceptance_rate)
            except (ValueError, TypeError):
                acceptance_rate = 0

        user_gpa_for_acc = preferences.get('gpa', 0)
        if not acceptance_rate:
            scores['acceptance'] = 0.5  # No data — neutral
        elif acceptance_rate >= 50:
            scores['acceptance'] = 1.0  # Easy to get in
        elif acceptance_rate >= 30:
            scores['acceptance'] = 0.85
        elif acceptance_rate >= 20:
            # Moderate — boost if student has strong GPA
            scores['acceptance'] = 0.75 if user_gpa_for_acc >= 3.5 else 0.6
        elif acceptance_rate >= 10:
            scores['acceptance'] = 0.6 if user_gpa_for_acc >= 3.7 else 0.4
        else:
            # Very competitive (<10%)
            scores['acceptance'] = 0.5 if user_gpa_for_acc >= 3.8 else 0.25

        # WORK VISA (4%) — important for international students
        work_visa = university.get('work_visa_available', 0)
        if isinstance(work_visa, str):
            try:
                work_visa = int(float(work_visa))
            except (ValueError, TypeError):
                work_visa = 0
        scores['work_visa'] = 1.0 if work_visa else 0.3

        # RESEARCH FIT (3%) — match research emphasis to student profile
        research_weight = university.get('research_weight', 0) or 0
        if isinstance(research_weight, str):
            try:
                research_weight = float(research_weight)
            except (ValueError, TypeError):
                research_weight = 0
        # Higher research weight universities score better (good for grad students)
        if research_weight >= 4:
            scores['research'] = 1.0
        elif research_weight >= 3:
            scores['research'] = 0.8
        elif research_weight >= 2:
            scores['research'] = 0.6
        else:
            scores['research'] = 0.4

        # Calculate weighted total criteria score
        # Boost budget weight when user has clear budget intent
        budget_w = self.BUDGET_WEIGHT
        qs_w = self.QS_RANKING_WEIGHT
        if budget_intent == 'cheap':
            # Boost budget weight, reduce QS ranking weight
            budget_w = 0.24
            qs_w = 0.04
        elif budget_intent == 'expensive':
            # Reduce budget weight, boost QS ranking
            budget_w = 0.04
            qs_w = 0.20

        scores['total_criteria'] = (
            scores['budget'] * (budget_w / self.CRITERIA_WEIGHT) +
            scores['gpa'] * (self.GPA_WEIGHT / self.CRITERIA_WEIGHT) +
            scores['field'] * (self.FIELD_WEIGHT / self.CRITERIA_WEIGHT) +
            scores['english'] * (self.ENGLISH_WEIGHT / self.CRITERIA_WEIGHT) +
            scores['scholarship'] * (self.SCHOLARSHIP_WEIGHT / self.CRITERIA_WEIGHT) +
            scores['qs_ranking'] * (qs_w / self.CRITERIA_WEIGHT) +
            scores['acceptance'] * (self.ACCEPTANCE_WEIGHT / self.CRITERIA_WEIGHT) +
            scores['work_visa'] * (self.WORK_VISA_WEIGHT / self.CRITERIA_WEIGHT) +
            scores['research'] * (self.RESEARCH_WEIGHT / self.CRITERIA_WEIGHT)
        )

        return scores

    def _fields_related(self, field1: str, field2: str) -> bool:
        """Check if two fields are related."""
        # Define related field groups
        related_groups = [
            {'computer science', 'software engineering', 'data science', 'artificial intelligence', 'machine learning', 'information technology', 'cs', 'cse', 'it'},
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
        user_budget = preferences.get('budget', 0)
        tuition = university.get('tuition_fees', 0)
        free_text = (preferences.get('free_text') or '').lower()
        cheap_keywords = ['affordable', 'cheap', 'low cost', 'low tuition', 'budget', 'inexpensive']
        expensive_keywords = ['expensive', 'premium', 'higher cost', 'high cost', 'top tier', 'prestigious']
        if not user_budget and any(kw in free_text for kw in cheap_keywords):
            if scores['budget'] >= 0.7:
                reasons.append(f"Affordable tuition: ${tuition:,.0f}/year")
            elif scores['budget'] >= 0.3:
                reasons.append(f"Moderate tuition: ${tuition:,.0f}/year")
            else:
                reasons.append(f"Expensive: ${tuition:,.0f}/year (you wanted affordable)")
        elif not user_budget and any(kw in free_text for kw in expensive_keywords):
            if scores['budget'] >= 0.8:
                reasons.append(f"Premium university: ${tuition:,.0f}/year")
            else:
                reasons.append(f"Lower tuition: ${tuition:,.0f}/year")
        elif not user_budget:
            reasons.append(f"Tuition: ${tuition:,.0f}/year" if tuition else "Tuition: Not specified")
        elif scores['budget'] >= 1.0:
            reasons.append(f"Within your budget of ${user_budget:,.0f}")
        elif scores['budget'] >= 0.7:
            reasons.append(f"Slightly over budget (${tuition:,.0f})")
        else:
            reasons.append(f"Over budget (${tuition:,.0f} vs ${user_budget:,.0f} budget)")

        # GPA reason
        user_gpa = preferences.get('gpa', 0)
        required_gpa = university.get('gpa_requirement', 0)
        if not user_gpa:
            reasons.append(f"GPA required: {required_gpa}" if required_gpa else "GPA: Not specified")
        elif scores['gpa'] >= 1.0:
            reasons.append(f"You meet the GPA requirement ({required_gpa})")
        else:
            reasons.append(f"GPA requirement is {required_gpa} (yours: {user_gpa})")

        # Field reason
        if scores['field'] >= 0.9:
            reasons.append("Exact field match")
        elif scores['field'] >= 0.7:
            reasons.append("Related field of study")

        # English requirement reason
        if scores.get('english', 0.5) >= 1.0:
            reasons.append("You meet the English requirement")
        elif scores.get('english', 0.5) < 0.5:
            test = preferences.get('english_test', '')
            if test == 'IELTS':
                req = university.get('ielts', 0)
            else:
                req = university.get('toefl', 0)
            if req:
                reasons.append(f"English requirement: {test} {req} (yours: {preferences.get('english_score', 'N/A')})")

        # Scholarship reason
        scholarship_info = str(university.get('scholarships', ''))
        if preferences.get('prefer_scholarship') and scores.get('scholarship', 0.5) >= 0.7:
            reasons.append(f"Scholarships: {scholarship_info}")
        elif preferences.get('prefer_scholarship') and scores.get('scholarship', 0.5) < 0.3:
            reasons.append("No scholarships available")

        # QS Ranking reason
        qs = scores.get('qs_ranking', 0.5)
        qs_rank = university.get('qs_ranking', '')
        if qs_rank:
            if qs >= 0.9:
                reasons.append(f"Top-ranked university (QS #{qs_rank})")
            elif qs >= 0.7:
                reasons.append(f"Highly ranked (QS #{qs_rank})")
            else:
                reasons.append(f"QS Ranking: #{qs_rank}")

        # Acceptance rate reason
        acc = university.get('acceptance_rate', 0)
        if acc:
            if scores.get('acceptance', 0.5) >= 0.85:
                reasons.append(f"Good admission chances ({acc}% acceptance)")
            elif scores.get('acceptance', 0.5) >= 0.6:
                reasons.append(f"Moderate admission ({acc}% acceptance)")
            elif scores.get('acceptance', 0.5) < 0.4:
                reasons.append(f"Highly competitive ({acc}% acceptance)")

        # Work visa reason
        if university.get('work_visa_available'):
            reasons.append("Post-study work visa available")

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
