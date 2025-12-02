# SmartStudy Abroad - Improvement Plan

## Executive Summary

This document outlines strategies to:
1. **Lower Costs** - Reduce API calls and optimize resources
2. **Add Features** - Enhance user experience
3. **Implement RAG** - Better search with AI
4. **Add MCP Server** - Extend Claude's capabilities

---

## Table of Contents

1. [Cost Optimization Strategies](#1-cost-optimization-strategies)
2. [Feature Improvements](#2-feature-improvements)
3. [RAG Model Implementation](#3-rag-model-implementation)
4. [MCP Server Integration](#4-mcp-server-integration)
5. [Implementation Priority](#5-implementation-priority)
6. [Technical Architecture](#6-technical-architecture)

---

## 1. Cost Optimization Strategies

### Current Problem:
- Every new search calls Claude API = $$$
- No smart caching strategy
- Redundant API calls

### Solutions:

#### 1.1 Smart Caching System (HIGH IMPACT)

```
Current Flow:
User searches "MIT CS" → Check DB → Not found → Call Claude ($0.01-0.05)

Improved Flow:
User searches "MIT CS" → Check DB → Check Similar → Check Embeddings →
If 80% match found → Return cached (FREE!)
Else → Call Claude → Cache result
```

**Implementation:**

```python
# backend/smart_cache.py

from sentence_transformers import SentenceTransformer
import numpy as np

class SmartCache:
    def __init__(self):
        # Free local embedding model (no API cost!)
        self.model = SentenceTransformer('all-MiniLM-L6-v2')

    def get_embedding(self, text):
        """Convert text to vector (numbers)"""
        return self.model.encode(text)

    def find_similar(self, query, threshold=0.85):
        """Find similar cached queries"""
        query_embedding = self.get_embedding(query)

        # Search in MongoDB for similar embeddings
        cached_items = db.cache.find()

        for item in cached_items:
            similarity = cosine_similarity(query_embedding, item['embedding'])
            if similarity >= threshold:
                return item['response']  # Return cached! (FREE)

        return None  # No match, need to call API
```

**Cost Savings:** 60-80% reduction in API calls

#### 1.2 Batch Processing

Instead of calling Claude for each field, batch multiple requests:

```python
# Before: 7 API calls for 7 data points
tuition = call_claude("MIT tuition")      # $0.01
deadline = call_claude("MIT deadline")    # $0.01
gpa = call_claude("MIT GPA")              # $0.01
# ... = $0.07 total

# After: 1 API call for all 7 data points
all_data = call_claude("""
For MIT Computer Science Master's program, provide:
1. Tuition fees
2. Application deadline
3. GPA requirement
4. English requirements
5. Test requirements
6. Scholarships
7. Program duration
""")  # $0.02-0.03 total

# Savings: ~50-70%
```

#### 1.3 Use Cheaper Models Strategically

```python
# Task-based model selection
def select_model(task_type):
    if task_type == "simple_lookup":
        return "claude-3-haiku"      # Cheapest: $0.00025/1K tokens
    elif task_type == "comparison":
        return "claude-3-sonnet"     # Medium: $0.003/1K tokens
    elif task_type == "complex_analysis":
        return "claude-3-opus"       # Best: $0.015/1K tokens
```

#### 1.4 Local LLM for Simple Tasks

```python
# Use free local models for simple tasks
from transformers import pipeline

# Free local model for simple Q&A
local_qa = pipeline("question-answering", model="distilbert-base-uncased")

def answer_simple_question(question, context):
    # Use free local model first
    result = local_qa(question=question, context=context)

    if result['score'] > 0.8:
        return result['answer']  # FREE!
    else:
        return call_claude(question)  # Fallback to paid API
```

#### 1.5 Cost Summary

| Strategy | Implementation Effort | Cost Reduction |
|----------|----------------------|----------------|
| Smart Caching | Medium | 60-80% |
| Batch Processing | Easy | 50-70% |
| Model Selection | Easy | 40-60% |
| Local LLM | Hard | 30-50% |

---

## 2. Feature Improvements

### 2.1 University Comparison Tool

```
┌────────────────────────────────────────────────────────┐
│                 Compare Universities                    │
├──────────────────┬──────────────────┬─────────────────┤
│       MIT        │     Stanford     │    Harvard      │
├──────────────────┼──────────────────┼─────────────────┤
│ Tuition: $55K    │ Tuition: $57K    │ Tuition: $52K   │
│ GPA: 3.7+        │ GPA: 3.6+        │ GPA: 3.8+       │
│ TOEFL: 100       │ TOEFL: 100       │ TOEFL: 104      │
│ Deadline: Dec 15 │ Deadline: Dec 1  │ Deadline: Dec 15│
└──────────────────┴──────────────────┴─────────────────┘
```

### 2.2 Application Tracker

```typescript
// Feature: Track application status
interface Application {
  university: string;
  status: 'planning' | 'documents' | 'submitted' | 'interview' | 'decision';
  deadline: Date;
  documents: {
    sop: boolean;
    lor: boolean;
    transcript: boolean;
    resume: boolean;
  };
  notes: string;
}
```

### 2.3 Deadline Calendar

```
┌─────────────────────────────────────────────┐
│           December 2024                      │
├───┬───┬───┬───┬───┬───┬───┬─────────────────┤
│ S │ M │ T │ W │ T │ F │ S │                 │
├───┼───┼───┼───┼───┼───┼───┤                 │
│   │   │   │   │   │   │ 1 │ 🔴 Stanford     │
│ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │                 │
│ 9 │10 │11 │12 │13 │14 │15 │ 🔴 MIT, Harvard │
│16 │17 │18 │19 │20 │21 │22 │                 │
└───┴───┴───┴───┴───┴───┴───┴─────────────────┘
```

### 2.4 Document Templates

- Statement of Purpose templates
- Letter of Recommendation requests
- Email templates for professors
- Resume/CV templates for grad school

### 2.5 Cost Calculator

```
┌─────────────────────────────────────────────┐
│         Total Cost Calculator               │
├─────────────────────────────────────────────┤
│ Tuition (2 years):     $110,000             │
│ Living Expenses:        $40,000             │
│ Health Insurance:        $4,000             │
│ Books & Supplies:        $2,000             │
│ Travel:                  $3,000             │
├─────────────────────────────────────────────┤
│ TOTAL:                 $159,000             │
│ Minus Scholarship:     -$30,000             │
├─────────────────────────────────────────────┤
│ YOU PAY:               $129,000             │
└─────────────────────────────────────────────┘
```

### 2.6 Visa Guide

- F-1 visa process for USA
- Tier 4 visa for UK
- Study permit for Canada
- Student visa for Germany

### 2.7 Scholarship Finder

AI-powered scholarship matching based on:
- Nationality
- Field of study
- GPA
- Financial need
- Special talents

### 2.8 Alumni Connect

Connect with alumni from target universities:
- LinkedIn integration
- Q&A platform
- Virtual coffee chats

---

## 3. RAG Model Implementation

### What is RAG?

```
RAG = Retrieval Augmented Generation

Traditional AI:
User Question → AI Model → Answer (from training data only)
                          ↓
                    May be outdated
                    May hallucinate

RAG:
User Question → Search Database → Get Relevant Docs → AI Model → Answer
                     ↓                    ↓
              Find real data       Based on actual data
                                   More accurate!
```

### 3.1 RAG Architecture for SmartStudy

```
┌─────────────────────────────────────────────────────────────────┐
│                        RAG System                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Document   │    │   Chunk &    │    │   Vector     │       │
│  │   Sources    │───►│   Embed      │───►│   Database   │       │
│  │              │    │              │    │  (Pinecone)  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│        │                                        │                │
│        │ PDFs, Websites                         │ Embeddings     │
│        │ University catalogs                    │                │
│        ▼                                        ▼                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     Query Flow                            │   │
│  │                                                           │   │
│  │  User Query → Embed → Search Vectors → Get Top 5 Docs    │   │
│  │       ↓                                      ↓            │   │
│  │  "MIT tuition"                        Found: MIT catalog  │   │
│  │       ↓                               page 45, 67, 89     │   │
│  │  ┌────────────────────────────────────────────┐          │   │
│  │  │            Claude AI                        │          │   │
│  │  │                                             │          │   │
│  │  │  Context: [MIT catalog pages]               │          │   │
│  │  │  Question: "What is MIT tuition?"           │          │   │
│  │  │  Answer: "$55,878 per year (2024-2025)"     │          │   │
│  │  └────────────────────────────────────────────┘          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Implementation Steps

#### Step 1: Collect Documents

```python
# backend/rag/document_collector.py

import requests
from bs4 import BeautifulSoup

class DocumentCollector:
    def __init__(self):
        self.sources = [
            "https://gradadmissions.mit.edu",
            "https://www.stanford.edu/admission",
            # ... more university websites
        ]

    def scrape_university(self, url):
        """Scrape university website for information"""
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract relevant content
        content = soup.get_text()
        return content

    def collect_pdfs(self, pdf_urls):
        """Download and extract text from PDFs"""
        import PyPDF2
        # ... extract text from admission guides, catalogs
```

#### Step 2: Chunk Documents

```python
# backend/rag/chunker.py

from langchain.text_splitter import RecursiveCharacterTextSplitter

def chunk_documents(documents):
    """Split documents into smaller chunks"""

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,        # 500 characters per chunk
        chunk_overlap=50,      # 50 character overlap
        separators=["\n\n", "\n", " ", ""]
    )

    chunks = []
    for doc in documents:
        doc_chunks = splitter.split_text(doc['content'])
        for i, chunk in enumerate(doc_chunks):
            chunks.append({
                'id': f"{doc['id']}_chunk_{i}",
                'content': chunk,
                'source': doc['source'],
                'university': doc['university']
            })

    return chunks

# Example:
# Original: 5000 word document
# After chunking: 50 chunks of ~100 words each
```

#### Step 3: Create Embeddings

```python
# backend/rag/embedder.py

from sentence_transformers import SentenceTransformer
# OR use OpenAI embeddings (paid but better)
# from openai import OpenAI

class Embedder:
    def __init__(self, use_local=True):
        if use_local:
            # FREE local model
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
        else:
            # Paid but better (OpenAI)
            self.client = OpenAI()

    def embed(self, text):
        """Convert text to vector"""
        if hasattr(self, 'model'):
            return self.model.encode(text).tolist()
        else:
            response = self.client.embeddings.create(
                model="text-embedding-3-small",
                input=text
            )
            return response.data[0].embedding

# Example:
# "MIT tuition is $55,000" → [0.12, -0.34, 0.56, ..., 0.78]
#                            (384 or 1536 dimensional vector)
```

#### Step 4: Store in Vector Database

```python
# backend/rag/vector_store.py

# Option 1: Pinecone (cloud, easy, paid)
import pinecone

pinecone.init(api_key="your-api-key")
index = pinecone.Index("smartstudy")

def store_embeddings(chunks, embeddings):
    vectors = []
    for chunk, embedding in zip(chunks, embeddings):
        vectors.append({
            'id': chunk['id'],
            'values': embedding,
            'metadata': {
                'content': chunk['content'],
                'university': chunk['university'],
                'source': chunk['source']
            }
        })

    index.upsert(vectors=vectors)

# Option 2: ChromaDB (local, free)
import chromadb

client = chromadb.Client()
collection = client.create_collection("smartstudy")

def store_embeddings_local(chunks, embeddings):
    collection.add(
        embeddings=embeddings,
        documents=[c['content'] for c in chunks],
        metadatas=[{'university': c['university']} for c in chunks],
        ids=[c['id'] for c in chunks]
    )

# Option 3: MongoDB Atlas Vector Search (if already using MongoDB)
# No additional database needed!
```

#### Step 5: RAG Query

```python
# backend/rag/query.py

class RAGQuery:
    def __init__(self):
        self.embedder = Embedder()
        self.vector_store = VectorStore()

    def query(self, question, top_k=5):
        """Answer question using RAG"""

        # Step 1: Embed the question
        question_embedding = self.embedder.embed(question)

        # Step 2: Search for similar documents
        results = self.vector_store.search(question_embedding, top_k=top_k)

        # Step 3: Build context from results
        context = "\n\n".join([r['content'] for r in results])

        # Step 4: Ask Claude with context
        prompt = f"""Based on the following information:

{context}

Answer this question: {question}

If the information is not in the context, say "I don't have specific information about this."
"""

        response = call_claude(prompt)

        return {
            'answer': response,
            'sources': [r['source'] for r in results]
        }
```

### 3.3 RAG Cost Analysis

| Component | Free Option | Paid Option |
|-----------|-------------|-------------|
| Embeddings | SentenceTransformers (local) | OpenAI ($0.0001/1K tokens) |
| Vector DB | ChromaDB (local) | Pinecone ($70/month) |
| LLM | - | Claude Haiku ($0.00025/1K) |

**Recommended:** Start with all free options, upgrade as needed.

---

## 4. MCP Server Integration

### What is MCP?

```
MCP = Model Context Protocol

It extends Claude's capabilities by connecting to external tools and data sources.

Without MCP:
Claude → Limited to training data

With MCP:
Claude → MCP Server → Database
                   → Web Scraping
                   → File System
                   → Custom APIs
                   → Real-time data
```

### 4.1 MCP Architecture for SmartStudy

```
┌─────────────────────────────────────────────────────────────────┐
│                      MCP Integration                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│   │   Claude    │◄────►│ MCP Server  │◄────►│   Tools     │     │
│   │   Desktop   │      │  (Python)   │      │             │     │
│   └─────────────┘      └─────────────┘      └─────────────┘     │
│                              │                     │             │
│                              │              ┌──────┴──────┐      │
│                              │              │             │      │
│                              ▼              ▼             ▼      │
│                        ┌─────────┐    ┌─────────┐   ┌─────────┐ │
│                        │ MongoDB │    │  Web    │   │  File   │ │
│                        │ Query   │    │ Scraper │   │ System  │ │
│                        └─────────┘    └─────────┘   └─────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 MCP Server Implementation

```python
# mcp_server/server.py

from mcp.server import Server
from mcp.types import Tool, TextContent
import mongodb_handler

# Create MCP server
server = Server("smartstudy-mcp")

# ============================================
# TOOL 1: Search University Database
# ============================================

@server.tool()
async def search_university(
    university: str,
    degree: str = "Master",
    field: str = ""
) -> str:
    """
    Search for university program information in the database.

    Args:
        university: Name of the university (e.g., "MIT", "Harvard")
        degree: Degree level (Bachelor, Master, PhD)
        field: Field of study (e.g., "Computer Science")

    Returns:
        Program information including tuition, deadlines, requirements
    """

    result = mongodb_handler.find_program(university, degree, field)

    if result:
        return f"""
Found program: {result['university']} - {result['degree']} in {result['field']}

Tuition: {result.get('tuition_fees', 'N/A')}
Deadline (Fall): {result.get('deadline_fall', 'N/A')}
GPA Requirement: {result.get('gpa_requirement', 'N/A')}
English Requirement: {result.get('english_requirements', 'N/A')}
Scholarships: {result.get('scholarships', 'N/A')}
Data Year: {result.get('data_year', 'N/A')}
"""
    else:
        return f"No data found for {university} {degree} in {field}"


# ============================================
# TOOL 2: Compare Universities
# ============================================

@server.tool()
async def compare_universities(
    universities: list[str],
    field: str,
    degree: str = "Master"
) -> str:
    """
    Compare multiple universities side by side.

    Args:
        universities: List of university names to compare
        field: Field of study
        degree: Degree level

    Returns:
        Comparison table of all universities
    """

    results = []
    for uni in universities:
        data = mongodb_handler.find_program(uni, degree, field)
        if data:
            results.append(data)

    if not results:
        return "No data found for any of the specified universities"

    # Format as comparison table
    comparison = "| University | Tuition | Deadline | GPA |\n"
    comparison += "|------------|---------|----------|-----|\n"

    for r in results:
        comparison += f"| {r['university']} | {r.get('tuition_fees', 'N/A')} | "
        comparison += f"{r.get('deadline_fall', 'N/A')} | {r.get('gpa_requirement', 'N/A')} |\n"

    return comparison


# ============================================
# TOOL 3: Scrape University Website
# ============================================

@server.tool()
async def scrape_university_info(
    url: str,
    info_type: str = "general"
) -> str:
    """
    Scrape information from a university website.

    Args:
        url: The university webpage URL
        info_type: Type of info to extract (general, tuition, deadlines, requirements)

    Returns:
        Extracted information from the webpage
    """

    import requests
    from bs4 import BeautifulSoup

    response = requests.get(url, timeout=10)
    soup = BeautifulSoup(response.text, 'html.parser')

    # Remove script and style elements
    for element in soup(['script', 'style', 'nav', 'footer']):
        element.decompose()

    text = soup.get_text(separator='\n', strip=True)

    # Limit to first 5000 characters
    return text[:5000]


# ============================================
# TOOL 4: Calculate Total Cost
# ============================================

@server.tool()
async def calculate_total_cost(
    tuition_per_year: float,
    years: int,
    living_cost_monthly: float = 2000,
    insurance_yearly: float = 2000,
    scholarship: float = 0
) -> str:
    """
    Calculate total cost of studying abroad.

    Args:
        tuition_per_year: Annual tuition fee in USD
        years: Number of years for the program
        living_cost_monthly: Monthly living expenses
        insurance_yearly: Annual health insurance cost
        scholarship: Total scholarship amount

    Returns:
        Detailed cost breakdown
    """

    total_tuition = tuition_per_year * years
    total_living = living_cost_monthly * 12 * years
    total_insurance = insurance_yearly * years

    subtotal = total_tuition + total_living + total_insurance
    final_total = subtotal - scholarship

    return f"""
Cost Breakdown for {years}-year program:

Tuition:        ${total_tuition:,.0f}
Living Expenses: ${total_living:,.0f}
Health Insurance: ${total_insurance:,.0f}
─────────────────────────────
Subtotal:       ${subtotal:,.0f}
Scholarship:    -${scholarship:,.0f}
─────────────────────────────
TOTAL:          ${final_total:,.0f}
"""


# ============================================
# TOOL 5: Find Scholarships
# ============================================

@server.tool()
async def find_scholarships(
    nationality: str,
    field: str,
    degree: str,
    gpa: float = 0
) -> str:
    """
    Find scholarships matching student profile.

    Args:
        nationality: Student's country of citizenship
        field: Field of study
        degree: Degree level (Bachelor, Master, PhD)
        gpa: Student's GPA (out of 4.0)

    Returns:
        List of matching scholarships
    """

    # Query scholarship database
    scholarships = mongodb_handler.find_scholarships({
        'nationality': nationality,
        'field': field,
        'degree': degree,
        'min_gpa': {'$lte': gpa}
    })

    if not scholarships:
        return "No matching scholarships found. Try broadening your search."

    result = "Matching Scholarships:\n\n"
    for s in scholarships:
        result += f"📚 {s['name']}\n"
        result += f"   Amount: {s['amount']}\n"
        result += f"   Deadline: {s['deadline']}\n"
        result += f"   Eligibility: {s['eligibility']}\n\n"

    return result


# ============================================
# RUN SERVER
# ============================================

if __name__ == "__main__":
    import asyncio
    from mcp.server.stdio import stdio_server

    async def main():
        async with stdio_server() as (read_stream, write_stream):
            await server.run(read_stream, write_stream)

    asyncio.run(main())
```

### 4.3 Configure Claude Desktop

Add to Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "smartstudy": {
      "command": "python",
      "args": ["D:/aos_project/499/mcp_server/server.py"],
      "env": {
        "MONGODB_URI": "mongodb://localhost:27017/"
      }
    }
  }
}
```

### 4.4 Using MCP with Claude

After setup, Claude can directly use these tools:

```
User: "Compare MIT, Stanford, and Harvard for Computer Science Master's"

Claude: [Uses compare_universities tool]
        Returns comparison table automatically

User: "What scholarships am I eligible for? I'm from India, applying for CS PhD, GPA 3.8"

Claude: [Uses find_scholarships tool]
        Returns matching scholarships

User: "Scrape the latest admission info from MIT's website"

Claude: [Uses scrape_university_info tool]
        Returns extracted information
```

---

## 5. Implementation Priority

### Phase 1: Quick Wins (1-2 weeks)

| Task | Impact | Effort | Priority |
|------|--------|--------|----------|
| Batch API calls | High | Low | ⭐⭐⭐ |
| Smart caching | High | Medium | ⭐⭐⭐ |
| University comparison | Medium | Low | ⭐⭐ |
| Cost calculator | Medium | Low | ⭐⭐ |

### Phase 2: Medium Term (3-4 weeks)

| Task | Impact | Effort | Priority |
|------|--------|--------|----------|
| RAG implementation | High | High | ⭐⭐⭐ |
| MCP server | High | Medium | ⭐⭐⭐ |
| Deadline calendar | Medium | Medium | ⭐⭐ |
| Document templates | Medium | Low | ⭐⭐ |

### Phase 3: Long Term (5-8 weeks)

| Task | Impact | Effort | Priority |
|------|--------|--------|----------|
| Application tracker | High | High | ⭐⭐ |
| Scholarship finder | High | High | ⭐⭐ |
| Alumni connect | Medium | High | ⭐ |
| Local LLM | Medium | High | ⭐ |

---

## 6. Technical Architecture

### Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Current System                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  User → Next.js → Flask → MongoDB                       │
│                      ↓                                   │
│                   Claude API                             │
│                                                          │
│  Problems:                                               │
│  • Every search calls Claude = expensive                 │
│  • No smart caching                                      │
│  • Limited features                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Improved Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Improved System                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐     ┌───────────┐     ┌─────────────────────────┐ │
│  │  Next.js │────►│   Flask   │────►│      Smart Cache        │ │
│  │ Frontend │     │  Backend  │     │  (Embeddings + MongoDB) │ │
│  └──────────┘     └───────────┘     └─────────────────────────┘ │
│       │                │                        │                │
│       │                │              ┌─────────┴─────────┐      │
│       │                │              │                   │      │
│       │                ▼              ▼                   ▼      │
│       │          ┌──────────┐   ┌──────────┐      ┌──────────┐  │
│       │          │   RAG    │   │  Vector  │      │  MongoDB │  │
│       │          │  Query   │   │    DB    │      │   Data   │  │
│       │          └──────────┘   └──────────┘      └──────────┘  │
│       │                │                                         │
│       │                ▼                                         │
│       │          ┌──────────────────────────────────────────┐   │
│       │          │              Claude API                   │   │
│       │          │  (Only called when cache miss + RAG miss) │   │
│       │          └──────────────────────────────────────────┘   │
│       │                                                          │
│       │          ┌──────────────────────────────────────────┐   │
│       └─────────►│            MCP Server                     │   │
│                  │  • Database queries                       │   │
│                  │  • Web scraping                           │   │
│                  │  • Calculations                           │   │
│                  │  • Scholarship search                     │   │
│                  └──────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow with Improvements

```
User Query: "MIT CS tuition"
     │
     ▼
┌─────────────────────────────────────────┐
│ Step 1: Check Smart Cache               │
│ Hash query → Look for similar queries   │
│ If 85%+ match → Return cached (FREE!)   │
└─────────────────────────────────────────┘
     │ Cache miss
     ▼
┌─────────────────────────────────────────┐
│ Step 2: Check MongoDB                    │
│ Exact match search                       │
│ If found → Return (FREE!)               │
└─────────────────────────────────────────┘
     │ DB miss
     ▼
┌─────────────────────────────────────────┐
│ Step 3: RAG Query                        │
│ Search vector DB for relevant docs       │
│ If good match → Answer from docs (FREE!) │
└─────────────────────────────────────────┘
     │ RAG insufficient
     ▼
┌─────────────────────────────────────────┐
│ Step 4: Claude API (Last resort)         │
│ Call Claude with context                 │
│ Save result to cache + DB               │
│ Cost: $0.01-0.05                        │
└─────────────────────────────────────────┘
```

---

## Summary

### Cost Reduction: 70-80% possible with:
1. Smart caching with embeddings
2. Batch processing
3. Strategic model selection
4. RAG for common queries

### Key Features to Add:
1. University comparison
2. Cost calculator
3. Deadline calendar
4. Scholarship finder
5. Application tracker

### Technical Improvements:
1. RAG for accurate, sourced answers
2. MCP server for extended capabilities
3. Vector database for semantic search
4. Local embeddings for cost savings

### Next Steps:
1. Implement smart caching (Week 1)
2. Add comparison feature (Week 1)
3. Set up RAG with ChromaDB (Week 2-3)
4. Create MCP server (Week 3-4)
5. Add remaining features (Week 5+)

---

## Questions to Consider

1. **Hosting**: Where will you deploy? (Vercel, AWS, self-hosted?)
2. **Budget**: What's your monthly API budget?
3. **Users**: Expected number of users?
4. **Data Sources**: Which universities to prioritize?
5. **Features**: Which features are most important to your users?

---

*Document created for SmartStudy Abroad improvement planning*
