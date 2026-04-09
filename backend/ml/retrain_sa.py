"""
Retrain teammate's GradientBoosting model locally.
Exact same logic from SA.ipynb — no changes to ML.
"""
import pandas as pd
import numpy as np
import warnings
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, r2_score, accuracy_score, f1_score
from sklearn.ensemble import GradientBoostingRegressor
import joblib
import os

warnings.filterwarnings('ignore')

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))

students = pd.read_csv(os.path.join(MODEL_DIR, 'student_dataset_multilabel.csv'))
unis = pd.read_csv(os.path.join(MODEL_DIR, 'university_dataset_multilabel.csv'))
unis['qs_ranking'] = pd.to_numeric(unis['qs_ranking'], errors='coerce').fillna(500)

print(f"Students loaded: {students.shape}")
print(f"Universities loaded: {unis.shape}")

# === CELL 3: Create Paired Dataset (exact same as SA.ipynb) ===
print("Creating paired dataset with GRE & SAT support...")
np.random.seed(42)

data = []
for _, student in students.iterrows():
    for _, uni in unis.iterrows():
        subject_map = {
            'arts': ['arts', 'arts_&_humanities'],
            'business': ['business', 'management', 'economics'],
            'computer science': ['computer_science', 'computing', 'informatics'],
            'engineering': ['engineering', 'robotics'],
            'medicine': ['medicine', 'life_sciences', 'biology', 'biotech']
        }
        subj_cols = subject_map.get(str(student['Subject_Pref']).lower(), [])
        subject_match = max([uni.get(col, 0) for col in subj_cols] + [0])

        budget_ratio = student['Budget_USD'] / max(uni['total_cost_estimated'], 1)

        gre = np.random.randint(290, 340) if np.random.rand() > 0.35 else 0
        sat = np.random.randint(1200, 1600) if np.random.rand() > 0.45 else 0

        row = {
            'GPA': student['GPA'],
            'IELTS': student['IELTS'],
            'GRE': gre,
            'SAT': sat,
            'Research_Exp': student['Research_Exp'],
            'ECA_Level': student['ECA_Level'],
            'Budget_USD': student['Budget_USD'],
            'Subject_Pref': student['Subject_Pref'],
            'Preferred_Country': student['Preferred_Country'],
            'country': uni['country'],
            'min_gpa': uni['min_gpa'],
            'Ielts_requirement': uni['Ielts_requirement'],
            'research_weight': uni['research_weight'],
            'eca_weight': uni['eca_weight'],
            'total_cost_estimated': uni['total_cost_estimated'],
            'qs_ranking': uni['qs_ranking'],
            'subject_match': subject_match,
            'gpa_diff': student['GPA'] - uni['min_gpa'],
            'ielts_diff': student['IELTS'] - uni['Ielts_requirement'],
            'gre_diff': (gre - 315) if gre > 0 else 0,
            'sat_diff': (sat - 1450) if sat > 0 else 0,
            'budget_ratio': budget_ratio
        }
        data.append(row)

paired_df = pd.DataFrame(data).sample(n=12000, random_state=42).reset_index(drop=True)

def calculate_match_score(row):
    gpa_score = max(0, min(1.0, (row['GPA'] - row['min_gpa'] + 0.5) / 1.0))
    ielts_score = max(0, min(1.0, (row['IELTS'] - row['Ielts_requirement'] + 1.0) / 2.0))
    gre_score = max(0, min(1.0, (row['GRE'] - 310) / 30)) if row['GRE'] > 0 else 0.5
    sat_score = max(0, min(1.0, (row['SAT'] - 1400) / 200)) if row['SAT'] > 0 else 0.5

    academic = (gpa_score + ielts_score + gre_score * 0.5 + sat_score * 0.3) / 2.3

    research = (row['research_weight'] / 5.0) if row['Research_Exp'] == 1 else 0.5
    eca = (row['eca_weight'] / 5.0) * (row['ECA_Level'] / 5.0)
    budget_score = min(1.0, max(0.1, row['budget_ratio'] * 0.8 + 0.2))

    rank = row['qs_ranking']
    if rank <= 10: ranking = 1.0
    elif rank <= 50: ranking = 0.85
    elif rank <= 100: ranking = 0.7
    elif rank <= 200: ranking = 0.5
    else: ranking = 0.25

    score = (academic * 0.35 + row['subject_match'] * 0.20 +
             research * 0.15 + eca * 0.10 +
             budget_score * 0.10 + ranking * 0.10)
    return max(0.0, min(1.0, score))

paired_df['match_score'] = paired_df.apply(calculate_match_score, axis=1)
paired_df['match_level'] = pd.cut(paired_df['match_score'], bins=[0, 0.65, 0.85, 1.0],
                                  labels=['Risky', 'Moderate', 'Safe'])

print(f"Paired dataset created: {paired_df.shape}")

# === CELL 5: Train (exact same as SA.ipynb) ===
X = paired_df.drop(['match_score', 'match_level'], axis=1)
y_reg = paired_df['match_score']
y_clf = paired_df['match_level']

categorical_cols = ['Subject_Pref', 'Preferred_Country', 'country']
numerical_cols = [col for col in X.columns if col not in categorical_cols]

preprocessor = ColumnTransformer([
    ('num', Pipeline([('imputer', SimpleImputer(strategy='median')),
                      ('scaler', StandardScaler())]), numerical_cols),
    ('cat', Pipeline([('imputer', SimpleImputer(strategy='most_frequent')),
                      ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))]), categorical_cols)
])

X_train, X_test, y_train_reg, y_test_reg = train_test_split(X, y_reg, test_size=0.2, random_state=42)
_, _, y_train_clf, y_test_clf = train_test_split(X, y_clf, test_size=0.2, random_state=42)

print("\nTraining GradientBoosting Regressor...")
model = GradientBoostingRegressor(n_estimators=250, random_state=42)
pipeline = Pipeline([('preprocessor', preprocessor), ('model', model)])
pipeline.fit(X_train, y_train_reg)

y_pred_reg = pipeline.predict(X_test)
mae = mean_absolute_error(y_test_reg, y_pred_reg)
r2 = r2_score(y_test_reg, y_pred_reg)
y_pred_clf = pd.cut(y_pred_reg, bins=[0, 0.65, 0.85, 1.0], labels=['Risky', 'Moderate', 'Safe'])
acc = accuracy_score(y_test_clf, y_pred_clf)
f1 = f1_score(y_test_clf, y_pred_clf, average='weighted')

print(f"GradientBoosting -> MAE: {mae:.4f} | R2: {r2:.4f} | Accuracy: {acc:.4f} | F1: {f1:.4f}")

# === Save ===
save_path = os.path.join(MODEL_DIR, 'university_match_pipeline.pkl')
joblib.dump(pipeline, save_path)
print(f"\nPipeline saved: {save_path}")

# Also save feature importances
feat_names = numerical_cols + list(pipeline.named_steps['preprocessor']
    .named_transformers_['cat']
    .named_steps['onehot']
    .get_feature_names_out(categorical_cols))
importances = model.feature_importances_
imp_df = pd.DataFrame({'Feature': feat_names, 'Importance': importances})
imp_df = imp_df.sort_values('Importance', ascending=False)
imp_path = os.path.join(MODEL_DIR, 'feature_importances_sa.csv')
imp_df.to_csv(imp_path, index=False)
print(f"Feature importances saved: {imp_path}")

print("\nDone!")
