# SmartStudy Abroad — Setup Guide

## Step 1: Install These Software

Download and install all three:

1. **Python 3.11** → https://www.python.org/downloads/
   - During installation, CHECK "Add Python to PATH"
2. **Node.js 18+** → https://nodejs.org/ (download LTS version)
3. **Git** → https://git-scm.com/

---

## Step 2: Clone the Project

Open terminal (Command Prompt or PowerShell) and run:

```bash
git clone https://github.com/saif543/smart-study-abroad.git
```

Then go inside the folder:

```bash
cd smart-study-abroad
```

Switch to the saif branch:

```bash
git checkout saif
```

---

## Step 3: Install Frontend (Next.js)

Still inside `smart-study-abroad/` folder, run:

```bash
npm install
```

Wait until it finishes. This installs React, Next.js, Tailwind CSS, etc.

---

## Step 4: Create Python Virtual Environment

```bash
cd backend
python -m venv venv
```

If `python` doesn't work on Windows, try:

```bash
py -m venv venv
```

This creates a `venv/` folder inside `backend/`.

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

You should see `(venv)` at the start of your terminal line. That means it's active.

---

## Step 6: Install Python Packages

With venv activated (you should see `(venv)` in terminal), run:

```bash
pip install flask flask-cors pymongo joblib numpy pandas scikit-learn chromadb sentence-transformers requests rank_bm25
```

Wait until everything finishes installing.

---

## Step 7: Start the Backend

Still inside `backend/` folder with venv activated, run:

```bash
python api_server.py
```

Or on Windows:

```bash
py api_server.py
```

Wait ~30 seconds. First time it downloads ~110MB of ML models (needs internet).

You should see:

```
ML predictor loaded successfully!
============================================================
SmartStudy Abroad API Server
============================================================
 * Running on http://0.0.0.0:5000
```

**Keep this terminal open. Don't close it.**

---

## Step 8: Start the Frontend

Open a **NEW / second terminal**.

Go to the project root folder:

```bash
cd smart-study-abroad
```

Run:

```bash
npm run dev
```

You should see:

```
✓ Ready in X.Xs
- Local: http://localhost:3000
```

**Keep this terminal open too.**

---

## Step 9: Open in Browser

Open your browser and go to:

**http://localhost:3000**

Click the **"Find For Me"** tab → fill the form → click "Find Best Matches" → see ML results.

---

## Summary: Two Terminals Running

| Terminal | Folder | Command | Port |
|----------|--------|---------|------|
| Terminal 1 | `smart-study-abroad/backend/` | `python api_server.py` | 5000 |
| Terminal 2 | `smart-study-abroad/` | `npm run dev` | 3000 |

Both must stay open while using the app.

---

## Next Time You Want to Run (After First Setup)

You don't need to install anything again. Just:

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

## Troubleshooting

**"python not found"**
→ Use `py` instead of `python` on Windows

**"npm not found"**
→ Install Node.js from https://nodejs.org/ and restart terminal

**"ML predictor not loaded"**
→ Make sure you're on the `saif` branch: `git checkout saif`

**"No results" on Find For Me**
→ Make sure backend terminal shows "Running on port 5000"

**"Cannot activate venv" on PowerShell**
→ Run this first: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**Import errors in Python**
→ Make sure venv is activated (you see `(venv)`) then run pip install again from Step 6
