"""
Build Unified ChromaDB from ML dataset (232 universities)
enriched with RAG fields (deadlines, program duration, etc.)

Output: One ChromaDB collection with ~500+ entries
(each university × each field it offers = one entry)
"""

import pandas as pd
import numpy as np
import chromadb
import json
import os
import re


def safe_float(val, default=0.0):
    """Safely convert a value to float, handling NA/NaN/whitespace strings."""
    if pd.isna(val):
        return default
    try:
        return float(str(val).strip())
    except (ValueError, TypeError):
        return default


def safe_int(val, default=0):
    """Safely convert a value to int, handling NA/NaN/whitespace strings."""
    return int(safe_float(val, float(default)))


def safe_bool(val, default=False):
    """Safely convert a value to bool."""
    if pd.isna(val):
        return default
    s = str(val).strip().lower()
    if s in ('', 'na', 'nan', 'none'):
        return default
    return bool(safe_float(val, 0))


def safe_str(val, default=''):
    """Safely convert a value to string."""
    if pd.isna(val):
        return default
    s = str(val).strip()
    if s.lower() in ('nan', 'na', 'none'):
        return default
    return s


# ----- Paths -----
ML_CSV = os.path.join('ml', 'university_dataset_multilabel.csv')
RAG_DB_PATH = os.path.join('rag', 'chroma_db_fresh')
NEW_DB_PATH = os.path.join('rag', 'chroma_db_unified')

# ----- Country name normalization (RAG uses short names, ML uses full) -----
COUNTRY_NORMALIZE = {
    'united kingdom': 'UK',
    'united states': 'USA',
    'united arab emirates': 'UAE',
    'russian federation': 'Russia',
    'south korea': 'South Korea',
    'hong kong': 'Hong Kong',
    'macao': 'Macao',
    'czech republic': 'Czech Republic',
}

def normalize_country(c):
    c_lower = c.strip().lower()
    return COUNTRY_NORMALIZE.get(c_lower, c.strip())

# ----- University name normalization for matching -----
def normalize_name(name):
    name = name.lower().strip()
    # Remove parenthetical abbreviations
    name = re.sub(r'\s*\([^)]*\)\s*', ' ', name).strip()
    # Remove extra spaces
    name = re.sub(r'\s+', ' ', name)
    return name

# ----- Living cost estimates by country (fallback) -----
LIVING_COST_FALLBACK = {
    'USA': 18000, 'UK': 15000, 'Canada': 14000, 'Australia': 16000,
    'Germany': 11000, 'France': 13000, 'Switzerland': 22000, 'Singapore': 15000,
    'China': 8000, 'Japan': 12000, 'South Korea': 10000, 'Hong Kong': 16000,
    'Netherlands': 13000, 'Sweden': 12000, 'Denmark': 14000, 'Norway': 15000,
    'Finland': 11000, 'Ireland': 13000, 'Belgium': 12000, 'Austria': 12000,
    'Italy': 11000, 'Spain': 10000, 'New Zealand': 14000, 'Taiwan': 8000,
    'UAE': 14000, 'Saudi Arabia': 10000, 'South Africa': 7000, 'Poland': 8000,
    'Czech Republic': 8000, 'Russia': 7000, 'Portugal': 9000, 'Slovenia': 9000,
    'Serbia': 6000, 'Romania': 6000, 'Bulgaria': 5000, 'Macao': 12000,
}

# ----- IELTS to TOEFL approximate conversion -----
def ielts_to_toefl(ielts):
    if pd.isna(ielts) or ielts == 0:
        return 0
    mapping = {9.0: 120, 8.5: 115, 8.0: 110, 7.5: 102, 7.0: 94,
               6.5: 79, 6.0: 60, 5.5: 46, 5.0: 35}
    # Find closest
    closest = min(mapping.keys(), key=lambda x: abs(x - ielts))
    return mapping[closest]

# ----- Default deadlines by country -----
DEADLINE_DEFAULTS = {
    'USA': {'fall': 'December 15 - January 15', 'spring': 'September 1 - October 1'},
    'UK': {'fall': 'January 15 - March 31', 'spring': 'N/A'},
    'Canada': {'fall': 'January 15 - March 1', 'spring': 'September 1'},
    'Australia': {'fall': 'October 31 - November 30', 'spring': 'April 30'},
    'Germany': {'fall': 'July 15', 'spring': 'January 15'},
    'Switzerland': {'fall': 'December 15', 'spring': 'N/A'},
    'Singapore': {'fall': 'January 15 - March 15', 'spring': 'July 15'},
    'China': {'fall': 'February - April', 'spring': 'September - November'},
    'Japan': {'fall': 'November - January', 'spring': 'N/A'},
    'Hong Kong': {'fall': 'December 1 - February 28', 'spring': 'N/A'},
    'Netherlands': {'fall': 'April 1', 'spring': 'November 1'},
    'France': {'fall': 'March - April', 'spring': 'October'},
    'South Korea': {'fall': 'March - May', 'spring': 'September - November'},
    'Sweden': {'fall': 'January 15', 'spring': 'N/A'},
    'Denmark': {'fall': 'March 15', 'spring': 'N/A'},
    'Ireland': {'fall': 'February 1', 'spring': 'N/A'},
}

# ----- Program duration defaults -----
DURATION_DEFAULTS = {
    'Graduate': '2 years',
    'Undergraduate': '4 years',
    'Doctoral': '4-5 years',
}


def load_rag_data():
    """Load existing RAG data for enrichment."""
    if not os.path.exists(RAG_DB_PATH):
        print("No existing RAG database found. Skipping enrichment.")
        return {}

    client = chromadb.PersistentClient(path=RAG_DB_PATH)
    col = client.get_collection('universities')
    results = col.get(limit=500, include=['metadatas'])

    # Build lookup: normalized_name -> list of metadata entries
    rag_map = {}
    for m in results['metadatas']:
        uni = m.get('university', '')
        norm = normalize_name(uni)
        if norm not in rag_map:
            rag_map[norm] = []
        rag_map[norm].append(m)

    print(f"Loaded {len(results['metadatas'])} RAG entries ({len(rag_map)} unique universities)")
    return rag_map


def find_rag_match(ml_name, rag_map):
    """Find matching RAG entries for an ML university name."""
    ml_norm = normalize_name(ml_name)

    # Exact match
    if ml_norm in rag_map:
        return rag_map[ml_norm]

    # Partial match
    for rn, entries in rag_map.items():
        if ml_norm in rn or rn in ml_norm:
            return entries
        # Match first 15 chars
        if len(ml_norm) > 10 and len(rn) > 10 and ml_norm[:15] == rn[:15]:
            return entries

    return None


def build_unified_entries(ml_df, rag_map):
    """Build unified entries: one per university × field combination."""
    entries = []
    subject_cols = [c for c in ml_df.columns if c not in [
        'university_name', 'country', 'degree_level', 'programs_offered',
        'qs_ranking', 'min_gpa', 'min_gre', 'Ielts_requirement', 'tuition_fee',
        'acceptance_rate', 'research_focus', 'scholarship_available',
        'max_coverage_percent', 'research_weight', 'eca_weight', 'living_cost',
        'total_cost_estimated', 'work_visa_available'
    ]]

    matched_count = 0
    unmatched_count = 0

    for _, row in ml_df.iterrows():
        uni_name = row['university_name']
        country = normalize_country(safe_str(row['country'], 'Unknown'))

        # Find RAG data for this university
        rag_entries = find_rag_match(uni_name, rag_map)
        if rag_entries:
            matched_count += 1
        else:
            unmatched_count += 1

        # Get active subject fields for this university
        active_fields = []
        for sc in subject_cols:
            try:
                if safe_float(row[sc]) == 1:
                    # Clean up field name
                    field_name = sc.replace('_', ' ').replace('&', 'and').title()
                    active_fields.append(field_name)
            except (ValueError, TypeError):
                pass

        # If no subject columns active, use programs_offered text
        if not active_fields:
            prog = str(row.get('programs_offered', ''))
            if prog and prog != 'nan':
                active_fields = [f.strip().title() for f in prog.split(',')]

        # Fallback
        if not active_fields:
            active_fields = ['General Studies']

        # Build base metadata from ML
        ielts = safe_float(row['Ielts_requirement'])
        toefl_est = ielts_to_toefl(ielts)
        tuition = safe_float(row['tuition_fee'])
        living = safe_float(row['living_cost'], LIVING_COST_FALLBACK.get(country, 12000))
        total = safe_float(row['total_cost_estimated'], tuition + living)
        qs = safe_int(row['qs_ranking'])
        min_gpa = safe_float(row['min_gpa'])
        acc_rate = safe_float(row['acceptance_rate'])
        scholarship = safe_bool(row['scholarship_available'])
        max_cov = safe_float(row['max_coverage_percent'])
        research_w = safe_float(row['research_weight'])
        eca_w = safe_float(row['eca_weight'])
        visa = safe_bool(row['work_visa_available'])
        research_focus = safe_str(row['research_focus'])
        programs_offered = safe_str(row['programs_offered'], ', '.join(active_fields).lower())
        degree_level = safe_str(row['degree_level'], 'Graduate')
        min_gre = safe_float(row.get('min_gre', 0))

        # Scholarship text
        if scholarship:
            if max_cov >= 100:
                scholarship_text = f"Available (up to full funding)"
            elif max_cov > 0:
                scholarship_text = f"Available (up to {int(max_cov)}%)"
            else:
                scholarship_text = "Available"
        else:
            scholarship_text = "Not Available"

        # English requirements text
        eng_parts = []
        if ielts > 0:
            eng_parts.append(f"IELTS {ielts}")
        if toefl_est > 0:
            eng_parts.append(f"TOEFL {toefl_est}")
        english_req_text = ' / '.join(eng_parts) if eng_parts else 'Contact university'

        # GRE text
        if min_gre > 0:
            gre_text = f"GRE Required (min {int(min_gre)})"
        else:
            gre_text = "GRE Not Required"

        # Default deadlines/duration
        country_deadlines = DEADLINE_DEFAULTS.get(country, {'fall': 'Contact university', 'spring': 'N/A'})
        default_duration = DURATION_DEFAULTS.get(degree_level, '2 years')

        # Create one entry per field
        for field_name in active_fields:
            # Try to find RAG data for this specific field
            rag_meta = None
            if rag_entries:
                # Look for field-specific RAG entry
                for re_entry in rag_entries:
                    rag_field = re_entry.get('field', '').lower().strip()
                    if field_name.lower() in rag_field or rag_field in field_name.lower():
                        rag_meta = re_entry
                        break
                # If no field match, use first RAG entry for deadlines/duration
                if rag_meta is None:
                    rag_meta = rag_entries[0]

            # Build final metadata — ML data as base, RAG overrides for specific fields
            metadata = {
                'university': uni_name,
                'country': country,
                'degree': degree_level if degree_level != 'nan' else 'Graduate',
                'field': field_name,
                'programs_offered': programs_offered,

                'qs_ranking': qs,
                'acceptance_rate': acc_rate,

                'gpa_requirement': min_gpa,
                'ielts': ielts,
                'toefl': toefl_est,
                'min_gre': min_gre,
                'english_requirements': english_req_text,
                'test_requirements': gre_text,

                'tuition_fees': tuition,
                'living_cost': living,
                'total_cost_estimated': total,

                'scholarship_available': 1 if scholarship else 0,
                'max_coverage_percent': max_cov,
                'scholarships': scholarship_text,

                'research_focus': research_focus,
                'research_weight': research_w,
                'eca_weight': eca_w,
                'work_visa_available': 1 if visa else 0,

                'program_duration': default_duration,
                'deadline_fall': country_deadlines['fall'],
                'deadline_spring': country_deadlines['spring'],
            }

            # Override with RAG data where RAG has better/specific info
            if rag_meta:
                # RAG has real deadline data (not defaults)
                if rag_meta.get('deadline_fall') and rag_meta['deadline_fall'] != 'N/A':
                    metadata['deadline_fall'] = rag_meta['deadline_fall']
                if rag_meta.get('deadline_spring') and rag_meta['deadline_spring'] != 'N/A':
                    metadata['deadline_spring'] = rag_meta['deadline_spring']
                # RAG has program duration
                if rag_meta.get('program_duration'):
                    metadata['program_duration'] = rag_meta['program_duration']
                # RAG has real TOEFL score (not estimated)
                if rag_meta.get('toefl') and float(rag_meta.get('toefl', 0)) > 0:
                    metadata['toefl'] = float(rag_meta['toefl'])
                    # Update english_requirements with real TOEFL
                    eng_parts_new = []
                    if metadata['ielts'] > 0:
                        eng_parts_new.append(f"IELTS {metadata['ielts']}")
                    eng_parts_new.append(f"TOEFL {int(metadata['toefl'])}")
                    metadata['english_requirements'] = ' / '.join(eng_parts_new)
                # RAG has better IELTS (sometimes different per program)
                if rag_meta.get('ielts') and float(rag_meta.get('ielts', 0)) > 0:
                    metadata['ielts'] = float(rag_meta['ielts'])
                # RAG has real GPA for specific program
                if rag_meta.get('gpa_requirement') and float(rag_meta.get('gpa_requirement', 0)) > 0:
                    metadata['gpa_requirement'] = float(rag_meta['gpa_requirement'])
                # RAG has test requirement details
                if rag_meta.get('test_requirements') and rag_meta['test_requirements'] != 'N/A':
                    metadata['test_requirements'] = rag_meta['test_requirements']
                # RAG has named scholarships
                if rag_meta.get('scholarships') and 'N/A' not in str(rag_meta.get('scholarships','')):
                    metadata['scholarships'] = rag_meta['scholarships']

            # Build document text for embedding
            doc_parts = [
                uni_name,
                metadata['degree'],
                field_name,
                country,
                f"tuition ${tuition:,.0f}" if tuition > 0 else '',
                f"total cost ${total:,.0f}" if total > 0 else '',
                f"GPA {min_gpa}" if min_gpa > 0 else '',
                f"IELTS {ielts}" if ielts > 0 else '',
                f"QS #{qs}" if qs > 0 else '',
                f"acceptance {acc_rate}%" if acc_rate > 0 else '',
                f"scholarships: {metadata['scholarships']}",
                f"visa: {'Yes' if visa else 'No'}",
                f"research: {research_focus}" if research_focus else '',
                f"programs: {programs_offered}",
            ]
            document = ' | '.join([p for p in doc_parts if p])

            entries.append({
                'metadata': metadata,
                'document': document,
                'id': f"{normalize_name(uni_name).replace(' ','_')}_{normalize_name(field_name).replace(' ','_')}",
            })

    print(f"\nML-RAG matched: {matched_count} universities")
    print(f"ML-only (defaults used): {unmatched_count} universities")
    print(f"Total entries created: {len(entries)} (university × field)")
    return entries


def create_chromadb(entries):
    """Create new ChromaDB collection with unified data."""
    from sentence_transformers import SentenceTransformer

    # Remove old unified db if exists
    import shutil
    build_path = NEW_DB_PATH + '_build'
    if os.path.exists(build_path):
        shutil.rmtree(build_path)
        print(f"Removed old build database at {build_path}")

    # Use sentence-transformers for embeddings (same model as RAG pipeline)
    st_model = SentenceTransformer('all-MiniLM-L6-v2')

    class STEmbeddingFunction:
        def __call__(self, input):
            return st_model.encode(input).tolist()

    client = chromadb.PersistentClient(path=build_path)
    collection = client.create_collection(
        name='universities',
        metadata={'hnsw:space': 'cosine'},
        embedding_function=STEmbeddingFunction()
    )

    # ChromaDB doesn't accept None/NaN — convert all values
    clean_entries = []
    for entry in entries:
        clean_meta = {}
        for k, v in entry['metadata'].items():
            if v is None or (isinstance(v, float) and np.isnan(v)):
                clean_meta[k] = 0 if isinstance(v, (int, float)) else ''
            else:
                clean_meta[k] = v
        clean_entries.append({
            'metadata': clean_meta,
            'document': entry['document'],
            'id': entry['id'],
        })

    # Add in batches
    batch_size = 100
    for i in range(0, len(clean_entries), batch_size):
        batch = clean_entries[i:i+batch_size]
        collection.add(
            ids=[e['id'] for e in batch],
            documents=[e['document'] for e in batch],
            metadatas=[e['metadata'] for e in batch],
        )
        print(f"  Added batch {i//batch_size + 1}: {len(batch)} entries")

    # Swap build into final path
    del client  # release lock
    if os.path.exists(NEW_DB_PATH):
        try:
            shutil.rmtree(NEW_DB_PATH)
        except PermissionError:
            print(f"WARNING: Could not remove old {NEW_DB_PATH} (in use). New DB at {build_path}")
            print(f"Stop backend, delete {NEW_DB_PATH}, rename {build_path} -> {NEW_DB_PATH}")
    if not os.path.exists(NEW_DB_PATH):
        os.rename(build_path, NEW_DB_PATH)
        print(f"\nNew ChromaDB created at: {NEW_DB_PATH}")
    else:
        print(f"\nNew ChromaDB built at: {build_path}")
    total = collection.count()
    print(f"Total entries: {total}")
    return collection


def verify(collection):
    """Quick verification of the new database."""
    print("\n===== VERIFICATION =====")
    print(f"Total entries: {collection.count()}")

    # Sample entry
    sample = collection.get(limit=1, include=['metadatas', 'documents'])
    print(f"\nSample entry:")
    meta = sample['metadatas'][0]
    for k, v in sorted(meta.items()):
        print(f"  {k}: {v}")
    print(f"  Document: {sample['documents'][0][:150]}...")

    # Count unique universities
    all_data = collection.get(limit=5000, include=['metadatas'])
    unis = set(m['university'] for m in all_data['metadatas'])
    countries = set(m['country'] for m in all_data['metadatas'])
    fields = set(m['field'] for m in all_data['metadatas'])
    print(f"\nUnique universities: {len(unis)}")
    print(f"Unique countries: {len(countries)}")
    print(f"Unique fields: {len(fields)}")

    # Check all 27 fields are present
    expected = ['university', 'country', 'degree', 'field', 'programs_offered',
                'qs_ranking', 'acceptance_rate', 'gpa_requirement', 'ielts', 'toefl',
                'min_gre', 'english_requirements', 'test_requirements',
                'tuition_fees', 'living_cost', 'total_cost_estimated',
                'scholarship_available', 'max_coverage_percent', 'scholarships',
                'research_focus', 'research_weight', 'eca_weight', 'work_visa_available',
                'program_duration', 'deadline_fall', 'deadline_spring']
    present = set(meta.keys())
    missing = set(expected) - present
    extra = present - set(expected)
    print(f"\nExpected fields: {len(expected)}")
    print(f"Present fields: {len(present)}")
    if missing:
        print(f"MISSING: {missing}")
    if extra:
        print(f"Extra: {extra}")
    if not missing:
        print("All 26 fields present!")


if __name__ == '__main__':
    print("=" * 60)
    print("Building Unified ChromaDB")
    print("=" * 60)

    # Load data
    ml_df = pd.read_csv(ML_CSV)
    print(f"\nML dataset: {len(ml_df)} universities, {len(ml_df.columns)} columns")

    rag_map = load_rag_data()

    # Build unified entries
    entries = build_unified_entries(ml_df, rag_map)

    # Create ChromaDB
    collection = create_chromadb(entries)

    # Verify
    verify(collection)

    print("\n" + "=" * 60)
    print("DONE!")
    print("=" * 60)
