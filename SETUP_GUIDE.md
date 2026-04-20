# SmartStudy Abroad — Setup Guide (v2)

## What This Project Does

- **Find For Me** — Enter your GPA, budget, field, English score → RAG system finds best-matching universities from 617 in database. Shows requirement checklist, fit label, gap tips.
- **Search University** — Search any university by name → Claude AI fetches tuition, deadlines, GPA, scholarships, etc. Caches results in MongoDB.
- **Cost Calculator** — Click "Cost breakdown" on any result → see total program cost with housing, meals, living expenses.
- **Chat** — Ask questions about your results using local Ollama LLM (optional).

---

## Step 1: Install Software

Download and install:

1. **Python 3.11** → https://www.python.org/downloads/
   - CHECK "Add Python to PATH" during installation
2. **Node.js 18+** → https://nodejs.org/ (LTS version)
3. **Git** → https://git-scm.com/

Optional (for Search University caching):
4. **MongoDB Community Server** → https://www.mongodb.com/try/download/community
   - During installation, check "Install MongoDB as a Service"

Optional (for Chat feature):
5. **Ollama** → https://ollama.com/
   - After install, run: `ollama pull mistral:instruct`

---

## Step 2: Clone the Project

Open terminal (Command Prompt or PowerShell):

```bash
git clone https://github.com/saif543/smart-study-abroad.git
cd smart-study-abroad
git checkout v2
```

---

## Step 3: Install Frontend

Inside `smart-study-abroad/` folder:

```bash
npm install
```

Wait until it finishes.

---

## Step 4: Create Python Virtual Environment

```bash
cd backend
python -m venv venv
```

If `python` doesn't work, try `py -m venv venv`

---

## Step 5: Activate the Virtual Environment

**Windows (Command Prompt):**
```bash
venv\Scripts\activate
```

**Windows (PowerShell):**
```bash
venv\Scripts\Activate.ps1
```

**Mac / Linux:**
```bash
source venv/bin/activate
```

You should see `(venv)` at the start of your terminal line.

---

## Step 6: Install Python Packages

With venv activated, run:

```bash
pip install flask flask-cors pymongo joblib numpy pandas scikit-learn chromadb sentence-transformers requests rank_bm25
```

---

## Step 7: Start the Backend

Still inside `backend/` with venv activated:

```bash
python api_server.py
```

Wait ~30 seconds. First time downloads ~110MB of ML models (needs internet).

You should see:

```
RAG matcher loaded successfully!
ML predictor loaded successfully!
============================================================
SmartStudy Abroad API Server
============================================================
 * Running on http://0.0.0.0:5000
```

**Keep this terminal open.**

---

## Step 8: Start the Frontend

Open a **second terminal**:

```bash
cd smart-study-abroad
npm run dev
```

You should see:

```
Ready in X.Xs
- Local: http://localhost:3000
```

**Keep this terminal open too.**

---

## Step 9: Open in Browser

Go to: **http://localhost:3000**

### Find For Me (RAG)
1. Click **"Find For Me"** tab
2. Fill in: Degree, Field, GPA, Budget, English Test + Score, Country
3. Optionally write preferences in the text box (e.g., "top ranked", "budget friendly")
4. Click **"Find Best Matches"**
5. Results show: match score, fit label (Strong/Good/Possible/Reach), requirement checklist
6. Click **"View details"** for full university info + gap tips
7. Click **"Cost breakdown"** for living cost estimate

### Search University (Claude AI)
1. Click **"Search"** tab (needs Claude CLI installed)
2. Enter university name, degree, field
3. Select which data points to fetch
4. Click **"Search University"**

---

## Summary: Two Terminals Running

| Terminal | Folder | Command | Port |
|----------|--------|---------|------|
| Terminal 1 | `smart-study-abroad/backend/` | `python api_server.py` | 5000 |
| Terminal 2 | `smart-study-abroad/` | `npm run dev` | 3000 |

Both must stay open while using the app.

---

## Next Time (After First Setup)

**Terminal 1:**
```bash
cd smart-study-abroad/backend
venv\Scripts\activate
python api_server.py
```

**Terminal 2:**
```bash
cd smart-study-abroad
npm run dev
```

Open http://localhost:3000

---

## What Works Without Optional Software

| Feature | Python + Node | + MongoDB | + Ollama | + Claude CLI |
|---------|:---:|:---:|:---:|:---:|
| Find For Me (RAG) | Yes | - | - | - |
| Cost Calculator | Yes | - | - | - |
| Search University | - | Caching | - | Yes (required) |
| Chat about results | - | - | Yes (required) | - |

**Find For Me works with just Python + Node.js. No extra software needed.**

---

## Troubleshooting

**"python not found"**
- Use `py` instead of `python` on Windows

**"npm not found"**
- Install Node.js and restart terminal

**"No results" on Find For Me**
- Make sure backend shows "Running on port 5000"

**"Cannot activate venv" on PowerShell**
- Run: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**Import errors in Python**
- Make sure venv is activated (you see `(venv)`) then run pip install from Step 6 again

**Search University shows error**
- Claude CLI must be installed and logged in
- MongoDB is optional (works without it, just no caching)

**Chat not working**
- Ollama must be running: `ollama serve`
- Model must be downloaded: `ollama pull mistral:instruct`
