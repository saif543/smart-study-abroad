# Smart Study Abroad - University Finder

A web application that helps students find universities based on their preferences using **RAG (Retrieval Augmented Generation)** technology.

## Features

- **Search Universities**: Browse and filter universities by country, field, degree
- **Find For Me (RAG)**: AI-powered matching that finds best universities based on your profile
- **Match Percentages**: See why each university matches your preferences

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Python, Flask
- **RAG System**: Sentence-Transformers, ChromaDB
- **Database**: MongoDB (for full features), JSON (for RAG demo)

---

## Installation Guide

### Step 1: Download Required Software

#### A) Install Node.js
1. Go to https://nodejs.org
2. Click the **LTS** button (green)
3. Run the downloaded file, click Next → Next → Install
4. Restart your computer

#### B) Install Python
1. Go to https://python.org/downloads
2. Click **Download Python 3.12**
3. Run the installer
4. **IMPORTANT**: Check the box **"Add Python to PATH"** at the bottom
5. Click Install Now
6. Restart your computer

---

### Step 2: Download the Project

```bash
git clone https://github.com/saif543/smart-study-abroad.git
cd smart-study-abroad
```

Or download ZIP from GitHub and extract it.

---

### Step 3: Open Two Command Prompts/Terminals

You need **two separate terminal windows** - one for backend, one for frontend.

---

### Step 4: Start Backend (First Terminal)

Navigate to backend folder:
```bash
cd backend
```

Create virtual environment:
```bash
python -m venv venv
```

Activate it:

**Windows:**
```bash
venv\Scripts\activate
```

**Mac/Linux:**
```bash
source venv/bin/activate
```

You should see `(venv)` at the start of the line.

Install dependencies:
```bash
pip install -r requirements.txt
```

Start the server:
```bash
python api_server.py
```

**Success looks like:**
```
Loading embedding model...
Model loaded! Produces 384-dimensional vectors
Loaded 100 universities into vector store
Running on http://127.0.0.1:5000
```

**Keep this terminal open!**

---

### Step 5: Start Frontend (Second Terminal)

Navigate to project root:
```bash
cd smart-study-abroad
```

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

**Success looks like:**
```
ready - started server on http://localhost:3000
```

---

### Step 6: Open the App

Open your browser and go to:
```
http://localhost:3000
```

Click the **"Find For Me"** tab to test the RAG-powered university matching!

---

## How RAG Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        HOW RAG WORKS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SETUP (One Time)                                            │
│     ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│     │ Universities │───▶│  Embedder    │───▶│  ChromaDB    │   │
│     │    JSON      │    │ (Text→384    │    │ (Vector      │   │
│     │              │    │   numbers)   │    │  Database)   │   │
│     └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                                 │
│  2. SEARCH (Every Query)                                        │
│     ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│     │ User Query   │───▶│  Embedder    │───▶│   Compare    │   │
│     │ "CS in USA"  │    │ (Text→384    │    │   Vectors    │   │
│     │              │    │   numbers)   │    │              │   │
│     └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                    │            │
│                                                    ▼            │
│                                            ┌──────────────┐     │
│                                            │ Top Matches  │     │
│                                            │ + Percentage │     │
│                                            └──────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Match Score Formula
- **40%** Semantic Similarity (how close the meaning is)
- **25%** Budget Match (tuition vs your budget)
- **20%** GPA Match (requirements vs your GPA)
- **15%** Field Match (exact field bonus)

---

## Project Structure

```
smart-study-abroad/
├── src/                    # Frontend (Next.js)
│   └── components/
│       ├── SearchTab.tsx
│       └── FindForMeTab.tsx
├── backend/
│   ├── api_server.py       # Flask API
│   ├── requirements.txt    # Python dependencies
│   ├── data/
│   │   └── universities.json
│   └── rag/                # RAG System
│       ├── embedder.py     # Text to vectors
│       ├── vector_store.py # ChromaDB wrapper
│       └── matcher.py      # Matching logic
└── README.md
```

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `'python' is not recognized` | Reinstall Python, check "Add to PATH" |
| `'npm' is not recognized` | Reinstall Node.js, restart computer |
| `Port 5000 already in use` | Close other programs or restart computer |
| `Module not found` | Run `pip install -r requirements.txt` again |
| `CORS error in browser` | Make sure backend is running on port 5000 |

---

## Why RAG Instead of Just LLM?

| Aspect | RAG | Pure LLM (ChatGPT) |
|--------|-----|---------------------|
| **Speed** | Milliseconds | 5-30 seconds |
| **Cost** | Free (local) | $0.01-0.10 per query |
| **Your Data** | Searches YOUR database | Doesn't know your data |
| **Accuracy** | 100% from your data | Can hallucinate |
| **Offline** | Works without internet | Needs API connection |

Modern AI systems use **RAG + LLM together** for best results.

---

## License

MIT License - Feel free to use for educational purposes.
