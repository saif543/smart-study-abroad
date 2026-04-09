# SmartStudy Abroad — Setup Guide

## How to Run on Your PC

### Step 1: Install Prerequisites

| Software | Version | Download |
|----------|---------|----------|
| Python | 3.11.x | https://www.python.org/downloads/ |
| Node.js | 18+ | https://nodejs.org/ |
| Git | Latest | https://git-scm.com/ |

Optional (not required for ML matching):

| Software | Purpose | Download |
|----------|---------|----------|
| MongoDB | Caching search results | https://www.mongodb.com/try/download/community |
| Ollama | AI chatbot feature | https://ollama.ai |

---

### Step 2: Clone the Repository

```bash
git clone https://github.com/saif543/smart-study-abroad.git
cd smart-study-abroad
git checkout saif
```

---

### Step 3: Install Frontend Dependencies

```bash
npm install
```

---

### Step 4: Install Backend Dependencies

```bash
pip install flask flask-cors pymongo joblib numpy pandas scikit-learn chromadb sentence-transformers requests rank_bm25
```

On Windows (if `pip` doesn't work):

```bash
py -m pip install flask flask-cors pymongo joblib numpy pandas scikit-learn chromadb sentence-transformers requests rank_bm25
```

---

### Step 5: Start the Backend

Open a terminal and run:

```bash
cd backend
py api_server.py
```

Wait until you see (takes ~30 seconds, first time downloads ~110MB of embedding models):

```
ML predictor loaded successfully!
============================================================
SmartStudy Abroad API Server
============================================================
 * Running on http://0.0.0.0:5000
```

---

### Step 6: Start the Frontend

Open a **second terminal** and run:

```bash
npm run dev
```

Wait for:

```
✓ Ready in X.Xs
- Local: http://localhost:3000
```

---

### Step 7: Open in Browser

Go to: **http://localhost:3000**

Click the **"Find For Me"** tab to use ML university matching.

---

## What Each Port Does

| Service | Port | Required |
|---------|------|----------|
| Next.js Frontend | 3000 | Yes |
| Flask Backend | 5000 | Yes |
| MongoDB | 27017 | No (optional caching) |
| Ollama LLM | 11434 | No (optional chatbot) |

---

## Project Structure

```
smart-study-abroad/
├── src/                              # FRONTEND (Next.js + React)
│   ├── app/
│   │   ├── page.tsx                  # Main page
│   │   └── api/                      # API proxy routes
│   │       ├── findme/route.ts       # → Flask /api/findme
│   │       ├── predict/route.ts      # → Flask /api/predict
│   │       ├── cost/route.ts         # → Flask /api/cost
│   │       └── chat/route.ts         # → Flask /api/chat
│   └── components/
│       ├── FindForMeTab.tsx          # ML university matching (main feature)
│       ├── AdmissionPredictor.tsx    # ML admission prediction
│       ├── CostCalculator.tsx        # Cost breakdown calculator
│       ├── SearchTab.tsx             # University search
│       ├── AIChat.tsx                # AI chatbot
│       └── Navbar.tsx                # Navigation bar
│
├── backend/                          # BACKEND (Python Flask)
│   ├── api_server.py                 # Flask server (all API endpoints)
│   ├── cost_calculator.py            # Cost calculation logic
│   ├── cost_of_living.json           # Cost data for 20+ countries
│   ├── ollama_handler.py             # Ollama LLM chat
│   ├── mongodb_handler.py            # MongoDB caching
│   │
│   ├── ml/                           # MACHINE LEARNING
│   │   ├── predictor.py              # GradientBoosting prediction logic
│   │   ├── retrain_sa.py             # Model retraining script
│   │   ├── university_match_pipeline.pkl    # Trained model (336KB)
│   │   ├── feature_importances_sa.csv       # Feature importance data
│   │   ├── university_dataset_multilabel.csv # 232 universities
│   │   └── student_dataset_multilabel.csv    # 500 student profiles
│   │
│   └── rag/                          # RAG (Retrieval-Augmented Generation)
│       ├── matcher.py                # Search orchestration
│       ├── embedder.py               # Sentence-transformers embeddings
│       ├── vector_store.py           # ChromaDB vector database
│       ├── bm25_search.py            # BM25 keyword search
│       ├── reranker.py               # Cross-encoder reranker
│       └── chroma_db_unified/        # Vector database (5.4MB, 617 entries)
│
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## First-Time Auto-Downloads

On first backend startup, these models download automatically (~110MB total):

| Model | Size | Purpose |
|-------|------|---------|
| all-MiniLM-L6-v2 | ~90 MB | Text embeddings |
| ms-marco-MiniLM-L-6-v2 | ~22 MB | Search reranking |

Needs internet first time only. Cached locally after that.

---

## Troubleshooting

**"ML predictor not loaded"**
→ Check `backend/ml/university_match_pipeline.pkl` exists in the repo

**"No results" on Find For Me**
→ Make sure backend is running: open http://localhost:5000/api/health in browser

**Frontend won't start**
→ Run `npm install` first. Check Node.js: `node --version` (need 18+)

**Python import errors**
→ Run the pip install command from Step 4 again. Check Python: `py --version` (need 3.11+)

**"Ollama: NOT AVAILABLE"**
→ This is fine. Only affects chatbot. ML matching works without Ollama.
