"""
Migrate university_dataset_multilabel.csv (75 cols, ML-era one-hot)
→ university_dataset_v2.csv (~30 cols, clean RAG-friendly schema)

Run once:  py backend/migrate_dataset.py
Then rebuild ChromaDB: py backend/build_unified_db.py
"""
import os
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'ml', 'university_dataset_multilabel.csv')
DST = os.path.join(HERE, 'ml', 'university_dataset_v2.csv')

# Identity-style cols we keep verbatim (others are subject one-hots)
KEEP = {
    'university_name', 'country', 'degree_level', 'programs_offered',
    'qs_ranking', 'min_gpa', 'min_gre', 'Ielts_requirement', 'tuition_fee',
    'acceptance_rate', 'research_focus', 'scholarship_available',
    'max_coverage_percent', 'research_weight', 'eca_weight', 'living_cost',
    'total_cost_estimated', 'work_visa_available', 'deadline_fall', 'deadline_spring',
}


def ielts_to_toefl(ielts: float) -> int:
    if not ielts or ielts < 4:
        return 0
    table = [
        (9.0, 120), (8.5, 115), (8.0, 110), (7.5, 102),
        (7.0, 94), (6.5, 79), (6.0, 60), (5.5, 46), (5.0, 35),
    ]
    for v, t in table:
        if ielts >= v:
            return t
    return 30


def ielts_to_duolingo(ielts: float) -> int:
    if not ielts or ielts < 4:
        return 0
    table = [
        (9.0, 160), (8.5, 150), (8.0, 140), (7.5, 130),
        (7.0, 120), (6.5, 110), (6.0, 100), (5.5, 95), (5.0, 85),
    ]
    for v, t in table:
        if ielts >= v:
            return t
    return 80


def main():
    df = pd.read_csv(SRC)
    one_hot_cols = [c for c in df.columns if c not in KEEP]
    print(f"Loaded {len(df)} rows, {len(df.columns)} cols. {len(one_hot_cols)} one-hot subject cols -> 'fields'")

    out = pd.DataFrame()

    # Identity
    out['university_name'] = df['university_name']
    out['country'] = df['country']
    out['city'] = ''  # optional — fill manually if useful
    out['qs_ranking'] = df['qs_ranking']

    # Program
    out['degree_level'] = df['degree_level']
    out['programs_offered'] = df['programs_offered'].fillna('')

    # Single 'fields' column from one-hots (only those flagged 1)
    def collapse_fields(row):
        active = []
        for col in one_hot_cols:
            try:
                v = float(row[col])
                if v >= 1:
                    active.append(col.replace('_', ' ').replace('&', 'and').strip())
            except (ValueError, TypeError):
                pass
        return ', '.join(active)

    out['fields'] = df.apply(collapse_fields, axis=1)

    # Academic requirements
    out['min_gpa'] = df['min_gpa']
    out['gre_required'] = df['min_gre'].apply(lambda v: 1 if pd.notna(v) and float(v) > 0 else 0)
    out['min_gre'] = df['min_gre']

    # English
    out['ielts_min'] = df['Ielts_requirement']
    out['toefl_min'] = df['Ielts_requirement'].apply(ielts_to_toefl)
    out['duolingo_min'] = df['Ielts_requirement'].apply(ielts_to_duolingo)

    # Research / Thesis (NEW — derived sensibly from research_weight)
    rw = df['research_weight'].fillna(0).astype(float)
    out['research_weight'] = rw
    out['research_focus'] = df['research_focus'].fillna('')
    # Thesis option offered (most graduate programs at research_weight >= 3 have thesis tracks)
    out['has_thesis_option'] = (rw >= 3).astype(int)
    out['eca_weight'] = df['eca_weight']

    # Money
    out['tuition_fee'] = df['tuition_fee']
    out['living_cost'] = df['living_cost']
    out['total_cost_estimated'] = df['total_cost_estimated']
    out['scholarship_available'] = df['scholarship_available']
    out['max_coverage_percent'] = df['max_coverage_percent']

    # Logistics
    out['work_visa_available'] = df['work_visa_available']
    out['deadline_fall'] = df['deadline_fall']
    out['deadline_spring'] = df['deadline_spring']

    # Outcomes (capacity for student to filter on)
    out['acceptance_rate'] = df['acceptance_rate']

    # Bangladesh-specific (the moat — manual fill)
    out['bd_admit_count_3yr'] = ''  # how many BD students admitted in last 3 years (per uni, approx)

    # Provenance
    out['last_updated'] = '2026-04-29'
    out['source_url'] = ''

    # Write
    out.to_csv(DST, index=False)
    print(f"Wrote {DST}")
    print(f"Rows: {len(out)}, Cols: {len(out.columns)}")
    print(f"Cols: {list(out.columns)}")


if __name__ == '__main__':
    main()
