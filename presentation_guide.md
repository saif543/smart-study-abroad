# SmartStudy Abroad — Presentation Slide Guide

> ML-Powered University Recommendation System
> Focus: "Find For Me" feature only (ML-based matching)

---

## Slide 1 — Title Slide

**Title:** SmartStudy Abroad — ML-Powered University Recommendation System
**Subtitle:** Personalized University Matching Using GradientBoosting
**Bottom:** Team member names, Course name, Date

**Visual:** Screenshot of the Find For Me tab (clean, form visible)

---

## Slide 2 — Problem Statement

**Title:** The Problem

- 30,000+ universities worldwide — students can't compare them all manually
- Every university has different GPA, IELTS, GRE, tuition, scholarship requirements
- Existing ranking sites (QS, US News) rank globally but don't personalize to a student's profile
- Students waste weeks researching and still miss good-fit universities

**Visual:** Icon or stock image of overwhelmed student with too many choices

---

## Slide 3 — Our Solution

**Title:** What SmartStudy Does

- Student enters their profile: GPA, IELTS, GRE, SAT, research experience, budget, preferred field & country
- ML model scores **ALL 232 universities** against that profile
- Ranks them by **admission probability (0–100%)**
- Categorizes each as **Safe** (≥85%), **Moderate** (≥65%), or **Risky** (<65%)
- Shows gap analysis — exactly what the student needs to improve
- Built-in Cost Calculator for 20+ countries

**Visual:** Screenshot of results showing university cards with percentage + category badges

---

## Slide 4 — System Architecture

**Title:** System Architecture

Draw as a diagram (boxes with arrows):

```
User (Browser)
      ↓
Next.js Frontend (React + TypeScript + Tailwind CSS)
      ↓
Next.js API Routes (Proxy)
      ↓
Flask Backend (Python)
      ↓
ML Predictor (GradientBoostingRegressor)
      ↓
232 Universities Scored & Ranked
```

**Visual:** Recreate as a proper architecture diagram with colored boxes and arrows

---

## Slide 5 — Tech Stack

**Title:** Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Flask (Python) |
| ML Model | Scikit-learn — GradientBoostingRegressor |
| Database | MongoDB (caching) |
| Dataset | 232 universities, 500 student profiles |

**Visual:** Technology logos arranged in a grid

---

## Slide 6 — Dataset

**Title:** Dataset Overview

### University Dataset (232 records)
- university_name, country, QS ranking
- min_gpa, IELTS requirement, tuition fee, total cost
- scholarship_available, max_coverage_percent
- research_weight, eca_weight, work_visa_available
- 60+ subject binary columns (computer_science, business, engineering, etc.)

### Student Dataset (500 synthetic profiles)
- GPA, IELTS, GRE, SAT
- Research_Exp (0/1), ECA_Level (0–5)
- Budget_USD, Subject_Pref, Preferred_Country

### Training Data
- Cross-joined students × universities → sampled to **12,000 pairs**

**Visual:** Small screenshot of CSV or a table showing 3–4 sample rows

---

## Slide 7 — Feature Engineering

**Title:** Feature Engineering

For each student-university pair, we compute:

| Feature | Description |
|---------|-------------|
| gpa_diff | Student GPA − University min_gpa |
| ielts_diff | Student IELTS − University IELTS requirement |
| gre_diff | Student GRE − 315 baseline |
| sat_diff | Student SAT − 1450 baseline |
| budget_ratio | Student budget / University total cost |
| subject_match | 1 if university offers student's field, else 0 |

Plus raw features: GPA, IELTS, GRE, SAT, Research_Exp, ECA_Level, Budget_USD, QS ranking, country, etc.

**Total: 22 features per pair**

**Visual:** Diagram showing "Student Features + University Features → Derived Features"

---

## Slide 8 — Match Score Formula (Label Generation)

**Title:** How Match Scores Are Calculated (Training Labels)

```
Match Score = Academic (35%) + Subject Match (20%) + Research (15%)
            + Extracurricular (10%) + Budget Fit (10%) + QS Ranking (10%)
```

| Component | Weight | Calculation |
|-----------|--------|-------------|
| Academic | 35% | GPA fit + IELTS fit + GRE fit + SAT fit |
| Subject Match | 20% | 1 if field offered, 0 otherwise |
| Research | 15% | research_weight × research_exp |
| Extracurricular | 10% | eca_weight × eca_level |
| Budget Fit | 10% | budget / total_cost (capped at 1.0) |
| QS Ranking | 10% | Top 10 = 1.0, Top 50 = 0.85, Top 100 = 0.7, etc. |

**Categories:** Safe ≥ 85% | Moderate ≥ 65% | Risky < 65%

**Visual:** Donut or pie chart of the 6 weight components

---

## Slide 9 — ML Training Pipeline

**Title:** ML Training Pipeline

Draw as a vertical flowchart:

```
12,000 Paired Samples
        ↓
Train/Test Split (80/20)
        ↓
Preprocessing:
  - Numerical → SimpleImputer (median) → StandardScaler
  - Categorical (Subject_Pref, Country) → OneHotEncoder
        ↓
GradientBoostingRegressor (n_estimators=250)
        ↓
Output: match_score (0–1)
        ↓
Categorize: Safe / Moderate / Risky
```

**Visual:** Recreate as a proper flowchart with colored boxes

---

## Slide 10 — Feature Importance

**Title:** What Drives the Predictions?

Horizontal bar chart:

| Feature | Importance |
|---------|-----------|
| Subject Match | 48.6% |
| IELTS Difference | 16.9% |
| GPA Difference | 8.4% |
| GPA | 8.4% |
| Research Experience | 5.8% |
| ECA Level | 3.0% |
| Budget Ratio | 2.3% |
| GRE Difference | 2.1% |
| QS Ranking | 1.7% |
| SAT Difference | 0.7% |

**Key Insight:** Subject match alone accounts for ~49% — choosing the right field matters most.

**Visual:** Create a horizontal bar chart in PowerPoint, or screenshot from app's feature importance section

---

## Slide 11 — Model Performance

**Title:** Model Evaluation

| Metric | Value |
|--------|-------|
| Algorithm | GradientBoostingRegressor |
| Training Samples | 12,000 pairs |
| Test Split | 20% (2,400 pairs) |
| R² Score | ~0.99 |
| Preprocessing | StandardScaler + OneHotEncoder |
| Inference | Scores all 232 universities in <100ms |

> **Action:** Run `py backend/ml/retrain_sa.py` to get exact MAE, R², Accuracy, F1 numbers. Replace the values above with real output.

**Visual:** Table styled as a card, or terminal screenshot showing training output

---

## Slide 12 — Prediction Flow (Runtime)

**Title:** How a Prediction Works

Step-by-step:

1. Student fills form → GPA: 3.5, IELTS: 7.0, Field: Computer Science, Budget: $40,000
2. Backend pairs this profile with ALL 232 universities
3. Computes derived features (gpa_diff, ielts_diff, subject_match, budget_ratio) for each pair
4. GradientBoosting predicts match_score for each pair
5. Sort by score → Top 5 shown with:
   - Admission probability %
   - Category badge (Safe / Moderate / Risky)
   - Gap analysis tags ("GPA gap: -0.3", "Budget tight")

**Visual:** Diagram: Form → 232 pairs → Model → Sorted Results

---

## Slide 13 — Gap Analysis

**Title:** Smart Gap Analysis

- For each university, model compares student vs requirements:
  - **GPA gap:** Student 3.2 vs Required 3.5 → "GPA gap: -0.3"
  - **IELTS gap:** Student 6.5 vs Required 7.0 → "IELTS gap: -0.5"
  - **Budget:** Student $30K vs Cost $45K → "Budget tight"
- Auto-generates improvement suggestions:
  - "Increase IELTS by 0.5 to unlock more Safe universities"
  - "Research experience would improve scores by ~6%"
- Summary across all 232: "Safe: 45, Moderate: 102, Risky: 85"

**Visual:** Screenshot of result cards showing gap tags + ML Profile Summary section with category counts

---

## Slide 14 — Cost Calculator

**Title:** Cost of Study Calculator

- 20+ countries with city-level data
- Breakdown: Tuition + Housing + Meal Plan + Living Costs + One-Time Costs
- Housing options: On-campus shared/single, Off-campus shared/single
- One-time costs: Visa, flight, relocation, setup
- Multi-year projection (Year 1 vs Year 2+)

**Visual:** Screenshot of the Cost Calculator modal

---

## Slide 15 — UI Demo (Screenshots)

**Title:** User Interface

Layout: 2×2 grid of screenshots:

1. **Top-left:** Find For Me form (filled out with sample data)
2. **Top-right:** Results — university cards with admission %, category badges
3. **Bottom-left:** Expanded card — detailed university info + gap analysis
4. **Bottom-right:** Cost Calculator breakdown

---

## Slide 16 — Future Work

**Title:** Future Enhancements

- Expand dataset (232 → 1000+ universities)
- Real-time data updates (tuition, deadlines)
- Compare multiple ML models (XGBoost, Random Forest, Neural Network)
- User accounts — save & track applications
- Mobile app version

---

## Slide 17 — Thank You

**Title:** Thank You — Questions?
**Bottom:** Team member names
