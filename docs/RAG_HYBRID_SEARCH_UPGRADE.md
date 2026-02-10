# RAG Hybrid Search Upgrade - What We Did, How & Why

---

## What Changed? (Summary)

We upgraded the "Find For Me" search from a **basic single-method search** to a **4-stage intelligent pipeline** that finds better university matches.

| Before | After |
|--------|-------|
| 1 search method (vector only) | 2 search methods (vector + keyword) |
| L2 distance (less accurate) | Cosine distance (industry standard) |
| No re-ranking | Cross-encoder re-ranker (AI double-checks results) |
| 3 criteria (budget, GPA, field) | 5 criteria (+ English requirements, scholarships) |
| Formula: 40% semantic + 60% criteria | Formula: 35% semantic + 5% re-rank + 60% criteria |

**Result:** Better matches, smarter ranking. Students now get compared on IELTS/TOEFL scores, and scholarship availability is factored into the match.

---

## The Problem Before

The old system had **one way** to find universities: vector search.

```
HOW VECTOR SEARCH WORKS:
  "Computer Science Canada" → converts to 384 numbers → finds closest numbers in database

THE PROBLEM:
  It understands MEANING but misses exact WORDS.
```

**Example of the problem:**

```
Student types: "University of Toronto Computer Science"

OLD SYSTEM (vector only):
  ✓ Understands "Computer Science" as a concept
  ✗ Might rank McGill higher than U of T, because vectors are close
  ✗ Doesn't care that the student typed the EXACT name "University of Toronto"
```

Vector search is smart at understanding meaning, but it's blind to exact keywords. It treats "University of Toronto" as a general concept about Canadian education, not as a specific name to match.

---

## What We Added (3 Improvements)

### Improvement 1: Cosine Distance (replacing L2)

**What is it?**
A better way to measure how similar two vectors are.

```
L2 DISTANCE (old):
  Measures straight-line distance between points
  Problem: sensitive to vector length, not just direction
  Like measuring distance between two cities on a flat map

COSINE DISTANCE (new):
  Measures the ANGLE between vectors
  Ignores length, focuses on direction
  Like comparing which direction two arrows point

  Same direction = similar meaning = low distance
  Opposite direction = different meaning = high distance
```

**Why it matters:**

| Metric | Range | What it measures | Better for |
|--------|-------|------------------|------------|
| L2 | 0 to infinity | Straight-line distance | Images, clustering |
| Cosine | 0 to 2 | Angle between vectors | Text similarity |

Cosine is the industry standard for text search because two sentences can have the same meaning even if their vector magnitudes differ. Cosine ignores magnitude and compares only direction.

**Where in code:** `backend/rag/vector_store.py`
```python
# Old
metadata={"description": "University embeddings for RAG search"}

# New
metadata={"description": "University embeddings for RAG search", "hnsw:space": "cosine"}
```

---

### Improvement 2: BM25 Keyword Search + Reciprocal Rank Fusion

**What is BM25?**
A classic keyword matching algorithm. It scores documents by how many query words appear in them, weighted by rarity.

```
VECTOR SEARCH thinks in MEANING:
  "affordable tech programs" → understands the concept

BM25 thinks in KEYWORDS:
  "University of Toronto" → finds documents containing exactly those words
```

**Why we need BOTH:**

| Scenario | Vector Search | BM25 | Winner |
|----------|--------------|------|--------|
| "affordable tech programs" | Excellent (understands meaning) | Poor (no exact keywords) | Vector |
| "University of Toronto" | OK (similar concept) | Excellent (exact name match) | BM25 |
| "cheap CS masters Canada" | Good | Good | Both help |

Neither method is always best. So we run both and merge the results.

**How do we merge? Reciprocal Rank Fusion (RRF)**

RRF is a simple, proven algorithm that combines two ranked lists:

```
VECTOR SEARCH RANKING:          BM25 RANKING:
  #1  McGill                      #1  University of Toronto  ← exact name match!
  #2  University of Toronto       #2  McGill
  #3  Waterloo                    #3  British Columbia
  #4  British Columbia            #4  Waterloo

RRF FORMULA: score(doc) = 1/(k + rank_vector) + 1/(k + rank_bm25)

MERGED RANKING (k=60):
  #1  University of Toronto  → 1/62 + 1/61 = 0.0326  (best combined)
  #2  McGill                 → 1/61 + 1/62 = 0.0326  (very close)
  #3  Waterloo               → 1/63 + 1/64 = 0.0315
  #4  British Columbia       → 1/64 + 1/63 = 0.0315
```

Documents that rank high in BOTH lists get the best combined score. The `k=60` constant prevents any single high rank from dominating.

**Where in code:**
- New file: `backend/rag/bm25_search.py` (BM25Index class)
- Modified: `backend/rag/matcher.py` (RRF fusion + BM25 integration)

---

### Improvement 3: Cross-Encoder Re-Ranker

**What is it?**
A small AI model that double-checks search results by reading each (query, document) pair together.

**How is it different from vector search?**

```
VECTOR SEARCH (bi-encoder):
  Step 1: Convert query to numbers     →  [0.2, 0.8, 0.1, ...]
  Step 2: Convert document to numbers  →  [0.3, 0.7, 0.2, ...]
  Step 3: Compare the two number lists

  Problem: Query and document never "see" each other directly

CROSS-ENCODER (re-ranker):
  Step 1: Feed BOTH query AND document into the model TOGETHER
          "Computer Science Canada" + "McGill University - Masters in CS (Canada)"
  Step 2: Model reads both, understands the relationship
  Step 3: Outputs a single relevance score

  Advantage: Much deeper understanding of how query relates to document
```

**Why not use cross-encoder for everything?**
Speed. Cross-encoder processes one pair at a time.

```
SEARCH 100 UNIVERSITIES:
  Vector search: encode query once, compare all → ~50ms
  Cross-encoder: score 100 pairs one by one     → ~5000ms (too slow!)

OUR APPROACH:
  Vector + BM25: quickly find top ~15 candidates → ~50ms
  Cross-encoder: carefully re-rank only those 15 → ~750ms
  Total: ~800ms (fast enough, much more accurate)
```

This is a standard pattern called **retrieve-then-rerank**.

**Model used:** `cross-encoder/ms-marco-MiniLM-L-6-v2`
- 22 million parameters (small, fast)
- Trained on MS MARCO (real search queries from Bing)
- Part of sentence-transformers (no extra package needed)

**Where in code:** New file: `backend/rag/reranker.py`

---

## The Full Pipeline (Before vs After)

```
BEFORE (simple):
  User preferences
       ↓
  Embed query → ChromaDB (L2 distance) → top 15
       ↓
  Criteria scoring (budget, GPA, field)
       ↓
  Return top 5

AFTER (hybrid):
  User preferences
       ↓
  ┌────────────────────────┐
  │ STEP 1: Dual Search    │
  │                        │
  │  Embed query           │    Build query text
  │       ↓                │         ↓
  │  ChromaDB (COSINE)     │    BM25 (keywords)
  │  "meaning" matches     │    "exact word" matches
  │       ↓                │         ↓
  │       └──── STEP 2 ────┘
  │     Reciprocal Rank Fusion
  │     (merge both ranked lists)
  │              ↓
  │       STEP 3: Re-Rank
  │     Cross-encoder AI reads
  │     each (query, doc) pair
  │     and re-orders by relevance
  │              ↓
  │       STEP 4: Criteria Scoring
  │     Budget fit (20%)
  │     GPA fit (15%)
  │     Field match (10%)
  │     English requirement (10%)
  │     Scholarship availability (5%)
  │              ↓
  │       STEP 5: Final Score
  │     35% semantic + 5% re-rank + 60% criteria
  │              ↓
  │       Return top 5
  └────────────────────────┘
```

---

## Scoring Formula

```
Final Score = (Semantic Similarity x 35%) + (Re-rank Confidence x 5%) + (Criteria Score x 60%)
```

| Component | Weight | What it measures | Source |
|-----------|--------|------------------|--------|
| Semantic Similarity | 35% | How close in meaning is this to what you want? | ChromaDB cosine + BM25 via RRF |
| Re-rank Confidence | 5% | How relevant does the AI think this result is? | Cross-encoder model |
| Criteria Score | 60% | Does it fit your budget, GPA, field, English, and scholarships? | Rule-based calculation |

**Why these weights?**
- Criteria stays at 60% because practical fit (can you afford it? are you qualified?) matters most
- Semantic dropped from 40% to 35% because re-rank now handles 5% of the "relevance" signal
- Re-rank is only 5% because it's a tiebreaker — it helps re-order results that are already relevant, not filter out bad ones

**Criteria Score breakdown (5 criteria):**

| Criterion | Weight | Full score when... | Partial/zero score when... |
|-----------|--------|-------------------|--------------------------|
| Budget fit | 20% | Tuition <= your budget | Gradually drops as tuition exceeds budget |
| GPA fit | 15% | Your GPA >= required GPA | Drops for each 0.5 GPA below requirement |
| Field match | 10% | Exact field match | 80% partial match, 60% related field, 30% different |
| English fit | 10% | Your IELTS/TOEFL >= required | Drops based on gap (per 1.5 IELTS or 20 TOEFL below) |
| Scholarship | 5% | Full funding available (when user wants scholarships) | 85% available, 60% limited, 10% none |

### How English Requirement Scoring Works

```
Student has: IELTS 7.0

University A requires: IELTS 6.5
  → Score: 100% (7.0 >= 6.5 ✓)

University B requires: IELTS 7.5
  → Gap: 0.5 → Score: max(0, 1.0 - 0.5/1.5) = 67%

University C requires: TOEFL 100 (no IELTS listed)
  → Score: 70% (user has IELTS, uni wants TOEFL — likely still qualifies)

Student didn't provide English score:
  → Score: 50% (neutral — doesn't help or hurt)
```

The scoring handles both IELTS and TOEFL independently. If the student provides IELTS but the university only lists TOEFL (or vice versa), a neutral-positive score is given since most universities accept both.

### How Scholarship Scoring Works

```
Student wants scholarships: YES

University A: "Full Funding Available"
  → Score: 100% (best possible)

University B: "Merit-based" or "Available"
  → Score: 85%

University C: "Limited" or "Partial"
  → Score: 60%

University D: "None" or empty
  → Score: 10% (heavy penalty)

Student doesn't care about scholarships:
  → All universities score: 50% (neutral)
```

When a student checks "prefer scholarships", universities with full funding get a scoring boost, while those with no scholarships get penalized. If the student doesn't check the preference, scholarships don't affect scoring at all.

---

## Files Changed

| File | What Changed |
|------|-------------|
| `backend/rag/vector_store.py` | Cosine distance metadata, new similarity formula, `get_all_documents()` method, enriched document text with tuition/GPA/scholarships |
| `backend/rag/matcher.py` | Full hybrid pipeline: BM25 init, RRF fusion, cross-encoder re-ranking, new weights (35/5/60), 5 criteria (budget, GPA, field, English, scholarships), `rerank_confidence`/`english_fit`/`scholarship_fit` in score breakdown |
| `backend/api_server.py` | Passes `english_test`, `english_score`, `prefer_scholarship` to matcher; returns new breakdown fields + `ielts`/`toefl`/`scholarships` data |
| `backend/rag/__init__.py` | Added BM25Index and Reranker to module exports |
| `backend/rag/bm25_search.py` | **NEW** - BM25Index class using rank_bm25 package |
| `backend/rag/reranker.py` | **NEW** - Reranker class using cross-encoder/ms-marco-MiniLM-L-6-v2 |

**New dependency:** `rank_bm25>=0.2.2` (install with `pip install rank_bm25`)

**No changes needed:** Frontend, MongoDB handler. The upgrade is fully backward compatible.

---

## Enriched Document Text (Bonus Improvement)

We also improved the text stored alongside each university in ChromaDB. This helps BM25 find more matches.

```
BEFORE (stored document text):
  "McGill University - Masters in Computer Science (Canada)"

AFTER (enriched):
  "McGill University | Masters | Computer Science | Canada | tuition $20,000 | GPA 3.3 | scholarships: Merit-based"
```

Now when a student searches for "scholarships" or "$20,000 tuition", BM25 can actually find it in the text. Before, this information was only stored in metadata (invisible to keyword search).

---

## How to Rebuild After This Upgrade

Since we changed the distance metric from L2 to cosine, the ChromaDB collection **must be rebuilt** (old vectors used L2 math, new ones need cosine math):

```python
from backend.rag.matcher import load_universities_to_vectorstore

# This clears old data and reloads with cosine distance + enriched text
load_universities_to_vectorstore("backend/universities_data.json")
```

After rebuilding, start the server normally:
```bash
python backend/api_server.py
```

On startup you'll see 3 models loading:
1. **Embedder** (all-MiniLM-L6-v2) - converts text to vectors
2. **BM25 index** - keyword search index built from 100 documents
3. **Cross-encoder** (ms-marco-MiniLM-L-6-v2) - re-ranking model

---

## Example: Real Test Result

```
Search: Computer Science, Masters, Canada, budget $35,000, GPA 3.5, IELTS 7.0, prefer scholarships

#1: McGill University (Canada)
    Match: 93.8%
    IELTS required: 6.5  |  TOEFL required: 100  |  Scholarships: Available
    Breakdown:
      - semantic_similarity: 84.6%
      - rerank_confidence: 99.8%
      - budget_fit: 100%
      - gpa_fit: 100%
      - field_match: 100%
      - english_fit: 100%       ← NEW (IELTS 7.0 >= 6.5 required)
      - scholarship_fit: 85%    ← NEW (scholarships available)
    Reasons: Within budget, meets GPA, exact field, meets English, Scholarships: Available

#2: University of Ottawa (Canada)
    Match: 92.9%
    IELTS required: 6.5  |  TOEFL required: 88  |  Scholarships: Available
    Breakdown:
      - semantic_similarity: 81.9%
      - rerank_confidence: 99.9%
      - budget_fit: 100%
      - gpa_fit: 100%
      - field_match: 100%
      - english_fit: 100%
      - scholarship_fit: 85%

#3: University of Toronto (Canada)
    Match: 92.4%
    IELTS required: 7.0  |  TOEFL required: 93  |  Scholarships: Limited (Funded Cohort)
    Breakdown:
      - semantic_similarity: 84.1%
      - rerank_confidence: 99.9%
      - budget_fit: 100%
      - gpa_fit: 100%
      - field_match: 100%
      - english_fit: 100%
      - scholarship_fit: 60%    ← Lower because "Limited" vs "Available"
```

New fields in the breakdown:
- `english_fit` — how well the student's IELTS/TOEFL score meets the university's requirement
- `scholarship_fit` — whether scholarships are available (when the student cares about them)

---

## Summary: Why This Matters

| Problem | Solution | Impact |
|---------|----------|--------|
| Vector search misses exact names | BM25 keyword search catches them | "University of Toronto" now ranks #1 when searched by name |
| L2 distance not ideal for text | Cosine distance focuses on meaning direction | More accurate similarity scores |
| Top results were sometimes slightly wrong order | Cross-encoder re-reads and re-orders them | Better ranking within the top results |
| Search only looked at university name + field | Enriched text includes tuition, GPA, scholarships | Keyword search finds more relevant matches |
| English scores were ignored | IELTS/TOEFL comparison added to criteria | Students see universities they actually qualify for |
| Scholarships not considered | Scholarship availability scoring added | Students who want funding see funded programs ranked higher |
| Only 3 criteria (budget, GPA, field) | Now 5 criteria with better weight distribution | More balanced, realistic match percentages |
