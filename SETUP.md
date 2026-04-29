# SmartStudy — Update & Run Guide

> If you already have the project running, follow this. Fresh install? Skip to the bottom.

---

## What changed in this update

- New dataset format (29 cols, was 75) — we now use `university_dataset_v2.csv`
- BM25 hybrid search added (faster + better matches)
- Profile-aware AI chat with **per-user memory** (Mistral 7B via Ollama)
- New dashboard layout, deadline timeline, cost calculator
- Fit + Admission Chance scoring (Safe / Target / Reach badges)

---

## Pull the new code

```powershell
cd C:\Users\arany\smart-study-abroad
git stash
git pull origin v2
git stash drop
```

---

## Update Python deps (one new package)

```powershell
cd C:\Users\arany\smart-study-abroad\backend
pip install -r requirements.txt
```

This adds `rank_bm25` (the rest you already have).

---

## Install Ollama + pull Mistral (one-time, ~5 GB)

The AI chat now runs locally on Mistral 7B.

1. Download and install **Ollama** for Windows: https://ollama.com/download
2. Open a new terminal and run:
   ```powershell
   ollama pull mistral
   ```
3. Keep Ollama running in the background (system tray icon).

> The app still works without Ollama — only the chatbot fails. Find For Me, dashboard, etc. all run fine.

---

## Rebuild the database (required — schema changed)

```powershell
cd C:\Users\arany\smart-study-abroad\backend

# 1. Convert old CSV to new v2 schema
python migrate_dataset.py

# 2. Wipe the old ChromaDB (it has stale schema)
Remove-Item -Recurse -Force rag\chroma_db_unified -ErrorAction SilentlyContinue

# 3. Rebuild from v2 CSV
python build_unified_db.py
```

If the rebuild ends with a **PermissionError on rename**, run this one-liner:
```powershell
Rename-Item rag\chroma_db_unified_build chroma_db_unified
```

You should end with one folder: `rag\chroma_db_unified`. ✅

---

## Run the app

**Terminal 1 — backend:**
```powershell
cd C:\Users\arany\smart-study-abroad\backend
python api_server.py
```

You should see:
```
Ollama: CONNECTED (Model 'mistral:instruct' ready)   ← if Ollama running
BM25 index built with 2559 documents                 ← hybrid search on
RAG Status: ENABLED
Universities in database: 2559
```

**Terminal 2 — frontend:**
```powershell
cd C:\Users\arany\smart-study-abroad
npm install      # only if package.json changed
npm run dev
```

Open `http://localhost:3000` (or `:3001` if 3000 is in use).

---

## Common issues

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: rank_bm25` | `pip install rank-bm25` |
| `Ollama: NOT AVAILABLE` | Start Ollama (system tray) → run `ollama pull mistral` |
| `PermissionError on chroma rename` | `Rename-Item rag\chroma_db_unified_build chroma_db_unified` |
| Chat says "Failed to get response" | Backend not running, or Ollama not running |
| Find For Me shows no results | Did you run `build_unified_db.py` after migrate? |
| Port 3000 already in use | Frontend will auto-switch to 3001 — check terminal output |

---

## Fresh install (first time on a machine)

```powershell
git clone <repo-url> smart-study-abroad
cd smart-study-abroad

# Backend
cd backend
pip install -r requirements.txt
python migrate_dataset.py
python build_unified_db.py

# Ollama (one-time)
# Install from https://ollama.com/download
ollama pull mistral

# Run backend
python api_server.py
```

In a second terminal:
```powershell
cd smart-study-abroad
npm install
npm run dev
```

---

## What to demo first

1. **Sign up** → fill profile (CGPA, IELTS, budget) → see profile-completion toast
2. **Find For Me** → field = "Computer Science", country = USA, type "budget friendly" in the description box → notice the Safe/Target/Reach badges
3. **Save 2-3 unis** → go to Pipeline (Kanban) and Deadlines (timeline)
4. **Cost breakdown** button on a result card → see the modal with stacked bar chart
5. **AI Chat** (bottom-right) → ask "compare top 3 for me" → it uses your search results + profile

---

That's it. Questions → ping in the group.
