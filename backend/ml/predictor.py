"""
ML Admission Predictor for SmartStudy Abroad

Uses GradientBoosting Regressor pipeline trained on 12,000 student-university pairs.
Pipeline includes ColumnTransformer (StandardScaler + OneHotEncoder) + GradientBoostingRegressor.

Inputs: GPA, IELTS, GRE, SAT, Research_Exp, ECA_Level, Budget_USD,
        Subject_Pref, Preferred_Country + university features.

Output: match_score (0-1) -> Safe (>=85%), Moderate (>=65%), Risky (<65%)
"""

import os
import joblib
import numpy as np
import pandas as pd

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))

PIPELINE_PATH = os.path.join(MODEL_DIR, 'university_match_pipeline.pkl')
FEATURE_IMPORTANCES_PATH = os.path.join(MODEL_DIR, 'feature_importances_sa.csv')
UNIVERSITY_DATA_PATH = os.path.join(MODEL_DIR, 'university_dataset_multilabel.csv')

# Country normalization (exact same as SA.ipynb Cell 7)
COUNTRY_MAP = {
    'us': 'United States', 'usa': 'United States', 'united states': 'United States',
    'uk': 'United Kingdom', 'united kingdom': 'United Kingdom', 'gb': 'United Kingdom',
    'germany': 'Germany', 'de': 'Germany',
    'canada': 'Canada', 'ca': 'Canada',
    'australia': 'Australia', 'au': 'Australia',
    'switzerland': 'Switzerland', 'singapore': 'Singapore',
    'china': 'China', 'france': 'France', 'netherlands': 'Netherlands', 'spain': 'Spain',
}

# Subject mapping for subject_match (exact same as SA.ipynb Cell 3)
SUBJECT_MAP_SA = {
    'arts': ['arts', 'arts_&_humanities'],
    'business': ['business', 'management', 'economics'],
    'computer science': ['computer_science', 'computing', 'informatics'],
    'cs': ['computer_science', 'computing', 'informatics'],
    'computer_science': ['computer_science', 'computing', 'informatics'],
    'engineering': ['engineering', 'robotics'],
    'medicine': ['medicine', 'life_sciences', 'biology', 'biotech'],
    'data science': ['computer_science', 'computing', 'informatics'],
    'finance': ['business', 'management', 'economics'],
    'mechanical engineering': ['engineering', 'robotics'],
    'electrical engineering': ['engineering', 'robotics'],
    'civil engineering': ['engineering', 'robotics'],
    'nursing': ['medicine', 'life_sciences', 'biology', 'biotech'],
    'pharmacy': ['medicine', 'life_sciences', 'biology', 'biotech'],
    'economics': ['business', 'management', 'economics'],
    'marketing': ['business', 'management', 'economics'],
    'management': ['business', 'management', 'economics'],
}

# Subject normalization for the pipeline's Subject_Pref column
SUBJECT_NORMALIZE = {
    'computer science': 'computer science',
    'cs': 'computer science',
    'computer_science': 'computer science',
    'data science': 'computer science',
    'artificial intelligence': 'computer science',
    'ai': 'computer science',
    'machine learning': 'computer science',
    'information technology': 'computer science',
    'it': 'computer science',
    'cybersecurity': 'computer science',
    'software engineering': 'computer science',
    'engineering': 'engineering',
    'mechanical engineering': 'engineering',
    'electrical engineering': 'engineering',
    'civil engineering': 'engineering',
    'chemical engineering': 'engineering',
    'biomedical engineering': 'engineering',
    'aerospace engineering': 'engineering',
    'robotics': 'engineering',
    'business': 'business',
    'mba': 'business',
    'management': 'business',
    'finance': 'business',
    'accounting': 'business',
    'marketing': 'business',
    'economics': 'business',
    'medicine': 'medicine',
    'medical': 'medicine',
    'nursing': 'medicine',
    'pharmacy': 'medicine',
    'public health': 'medicine',
    'health sciences': 'medicine',
    'biotech': 'medicine',
    'biology': 'medicine',
    'arts': 'arts',
    'humanities': 'arts',
    'law': 'arts',
    'education': 'arts',
    'social sciences': 'arts',
    'journalism': 'arts',
    'design': 'arts',
}


class AdmissionPredictor:
    def __init__(self):
        self.pipeline = None
        self.feature_importances = None
        self.university_df = None
        self.model_version = None
        self._load()

    def _load(self):
        if os.path.exists(PIPELINE_PATH):
            self.pipeline = joblib.load(PIPELINE_PATH)
            self.model_version = 'sa'
            print(f"  ML model loaded: GradientBoosting pipeline (SA)")
        else:
            raise FileNotFoundError("No ML pipeline found (need university_match_pipeline.pkl)")

        if os.path.exists(FEATURE_IMPORTANCES_PATH):
            self.feature_importances = pd.read_csv(FEATURE_IMPORTANCES_PATH)

        if os.path.exists(UNIVERSITY_DATA_PATH):
            self.university_df = pd.read_csv(UNIVERSITY_DATA_PATH)
            self.university_df['qs_ranking'] = pd.to_numeric(
                self.university_df['qs_ranking'], errors='coerce'
            ).fillna(500)
            print(f"  University dataset: {len(self.university_df)} universities")

    def _normalize_country(self, country_input: str) -> str:
        if not country_input:
            return ''
        return COUNTRY_MAP.get(country_input.lower().strip(), country_input.strip().title())

    def _normalize_subject(self, field: str) -> str:
        if not field:
            return 'engineering'
        return SUBJECT_NORMALIZE.get(field.lower().strip(), 'engineering')

    def _get_subject_match(self, field: str, uni: pd.Series) -> int:
        """Check if university offers the student's subject (exact same as SA.ipynb)."""
        field_lower = field.lower().strip()
        subj_cols = SUBJECT_MAP_SA.get(field_lower, [])
        if not subj_cols:
            # Try normalized subject
            normalized = self._normalize_subject(field_lower)
            subj_cols = SUBJECT_MAP_SA.get(normalized, [])
        return max([uni.get(col, 0) for col in subj_cols] + [0])

    def match_top_universities(self, student_profile: dict, top_k: int = 10) -> dict:
        """
        Main prediction: matches student against all universities.
        Uses GradientBoosting pipeline — exact same as SA.ipynb Cell 7.
        """
        if self.university_df is None:
            return {'error': 'University dataset not loaded'}
        if self.pipeline is None:
            return {'error': 'Pipeline not loaded'}

        gpa = float(student_profile.get('gpa', 0))
        ielts = float(student_profile.get('ielts', 0))
        gre = float(student_profile.get('gre', 0))
        sat = float(student_profile.get('sat', 0))
        research_exp = int(student_profile.get('research_exp', 0))
        eca_level = int(student_profile.get('eca_level', 0))
        budget = float(student_profile.get('budget', 0))
        field = student_profile.get('field', '')
        preferred_country = student_profile.get('preferred_country', '')

        # Normalize inputs (exact same as SA.ipynb Cell 7)
        normalized_country = self._normalize_country(preferred_country)
        normalized_subject = self._normalize_subject(field)

        # Feature importances
        factors = {}
        if self.feature_importances is not None:
            for _, row in self.feature_importances.head(15).iterrows():
                factors[row['Feature']] = round(float(row['Importance']) * 100, 1)

        # Predict for every university (exact same as SA.ipynb Cell 7)
        matches = []
        for _, uni in self.university_df.iterrows():
            subject_match = self._get_subject_match(field, uni)

            # Build input row — exact same features as SA.ipynb
            row = {
                'GPA': gpa,
                'IELTS': ielts,
                'GRE': gre,
                'SAT': sat,
                'Research_Exp': research_exp,
                'ECA_Level': eca_level,
                'Budget_USD': budget,
                'Subject_Pref': normalized_subject,
                'Preferred_Country': normalized_country,
                'country': uni['country'],
                'min_gpa': uni['min_gpa'],
                'Ielts_requirement': uni['Ielts_requirement'],
                'research_weight': uni['research_weight'],
                'eca_weight': uni['eca_weight'],
                'total_cost_estimated': uni['total_cost_estimated'],
                'qs_ranking': uni['qs_ranking'],
                'subject_match': subject_match,
                'gpa_diff': gpa - uni['min_gpa'],
                'ielts_diff': ielts - uni['Ielts_requirement'],
                'gre_diff': (gre - 315) if gre > 0 else 0,
                'sat_diff': (sat - 1450) if sat > 0 else 0,
                'budget_ratio': budget / max(uni['total_cost_estimated'], 1)
            }

            input_df = pd.DataFrame([row])

            try:
                score = float(self.pipeline.predict(input_df)[0])
            except Exception:
                score = 0.5

            percent = round(score * 100, 1)
            percent = min(95, max(5, percent))

            # Category (exact same as SA.ipynb)
            if percent >= 85:
                category = "Safe"
            elif percent >= 65:
                category = "Moderate"
            else:
                category = "Risky"

            min_gpa = float(uni.get('min_gpa', 0)) if pd.notna(uni.get('min_gpa')) else 0
            min_ielts = float(uni.get('Ielts_requirement', 0)) if pd.notna(uni.get('Ielts_requirement')) else 0
            tuition = float(uni.get('tuition_fee', 0)) if pd.notna(uni.get('tuition_fee')) else 0
            qs_rank = int(uni['qs_ranking']) if pd.notna(uni.get('qs_ranking')) else None
            acc_rate = float(uni.get('acceptance_rate', 0)) if pd.notna(uni.get('acceptance_rate')) else None
            scholarship = bool(uni.get('scholarship_available', False))

            # Check field match for display
            subject_matched = bool(subject_match)

            # Gap analysis
            gaps = []
            if min_gpa > 0 and gpa > 0:
                if gpa >= min_gpa * 1.1:
                    gaps.append({'factor': 'GPA', 'status': 'strong', 'detail': f'Your GPA ({gpa}) exceeds requirement ({min_gpa})'})
                elif gpa >= min_gpa:
                    gaps.append({'factor': 'GPA', 'status': 'meets', 'detail': f'Your GPA ({gpa}) meets requirement ({min_gpa})'})
                else:
                    gaps.append({'factor': 'GPA', 'status': 'below', 'detail': f'Your GPA ({gpa}) is below requirement ({min_gpa})'})

            if min_ielts > 0 and ielts > 0:
                if ielts >= min_ielts + 0.5:
                    gaps.append({'factor': 'IELTS', 'status': 'strong', 'detail': f'Your IELTS ({ielts}) exceeds requirement ({min_ielts})'})
                elif ielts >= min_ielts:
                    gaps.append({'factor': 'IELTS', 'status': 'meets', 'detail': f'Your IELTS ({ielts}) meets requirement ({min_ielts})'})
                else:
                    gaps.append({'factor': 'IELTS', 'status': 'below', 'detail': f'Your IELTS ({ielts}) is below requirement ({min_ielts})'})

            if tuition > 0 and budget > 0:
                if budget >= tuition:
                    gaps.append({'factor': 'Budget', 'status': 'strong' if budget >= tuition * 1.2 else 'meets',
                                 'detail': f'Budget (${budget:,.0f}) covers tuition (${tuition:,.0f})'})
                else:
                    gaps.append({'factor': 'Budget', 'status': 'below',
                                 'detail': f'Budget (${budget:,.0f}) below tuition (${tuition:,.0f})'})

            is_preferred = 1 if normalized_country and uni['country'].lower() == normalized_country.lower() else 0

            matches.append({
                'university_name': uni['university_name'],
                'country': str(uni.get('country', 'N/A')),
                'category': category,
                'admission_probability': percent,
                'qs_ranking': qs_rank,
                'tuition_fee': tuition,
                'min_gpa': min_gpa,
                'ielts_requirement': min_ielts,
                'acceptance_rate': acc_rate,
                'scholarship_available': scholarship,
                'subject_match': subject_matched,
                'gap_analysis': gaps,
                'is_preferred': is_preferred,
            })

        # Sort: preferred country first, then by match % (exact same as SA.ipynb)
        matches.sort(key=lambda x: (x['is_preferred'], x['admission_probability']), reverse=True)

        # Separate by category
        safe = [m for m in matches if m['category'] == 'Safe']
        moderate = [m for m in matches if m['category'] == 'Moderate']
        risky = [m for m in matches if m['category'] == 'Risky']

        # Top 10 (same as SA.ipynb — sorted by preferred + score)
        top_matches = matches[:top_k]

        # Overall probability
        if matches:
            top_20 = sorted([m['admission_probability'] for m in matches], reverse=True)[:20]
            overall_prob = round(sum(top_20) / len(top_20), 1)
        else:
            overall_prob = 0

        if overall_prob >= 80:
            confidence = 'High'
        elif overall_prob >= 60:
            confidence = 'Medium'
        else:
            confidence = 'Low'

        ml_result = {
            'ml_probability': overall_prob,
            'confidence': confidence,
        }

        # Improvement suggestions
        improvements = self._suggest_improvements(matches, gpa, ielts, budget)

        recommendation = self._generate_recommendation(
            overall_prob, gpa, ielts, gre, sat, research_exp, eca_level, budget
        )

        return {
            'ml_prediction': ml_result,
            'recommendation': recommendation,
            'factors': factors,
            'universities': top_matches,
            'total_matched': len(matches),
            'total_in_dataset': len(self.university_df),
            'category_counts': {
                'safe': len(safe),
                'moderate': len(moderate),
                'risky': len(risky),
            },
            'improvements': improvements,
            'model_version': self.model_version,
            'profile': {
                'gpa': gpa,
                'ielts': ielts,
                'gre': gre,
                'sat': sat,
                'research_exp': research_exp,
                'eca_level': eca_level,
                'budget': budget,
                'field': field,
                'preferred_country': preferred_country,
            }
        }

    def _suggest_improvements(self, matches, gpa, ielts, budget):
        suggestions = []

        if gpa < 3.8:
            better_gpa = min(4.0, gpa + 0.3)
            would_unlock = 0
            for m in matches:
                if m['category'] == 'Risky':
                    min_gpa = m.get('min_gpa', 0)
                    if min_gpa > 0 and gpa < min_gpa and better_gpa >= min_gpa:
                        would_unlock += 1
            if would_unlock > 0:
                suggestions.append({
                    'action': f'Improve GPA from {gpa} to {better_gpa}',
                    'impact': f'{would_unlock} more universities become Moderate/Safe',
                })

        if ielts < 8.0:
            better_ielts = min(9.0, ielts + 1.0)
            would_unlock = 0
            for m in matches:
                if m['category'] == 'Risky':
                    min_ielts = m.get('ielts_requirement', 0) or 0
                    if min_ielts > 0 and ielts < min_ielts and better_ielts >= min_ielts:
                        would_unlock += 1
            if would_unlock > 0:
                suggestions.append({
                    'action': f'Improve IELTS from {ielts} to {better_ielts}',
                    'impact': f'{would_unlock} more universities become reachable',
                })

        if budget > 0 and budget < 50000:
            better_budget = int(budget * 1.5)
            would_unlock = 0
            for m in matches:
                if m['category'] == 'Risky':
                    tuition = m.get('tuition_fee', 0) or 0
                    if tuition > 0 and budget < tuition and better_budget >= tuition:
                        would_unlock += 1
            if would_unlock > 0:
                suggestions.append({
                    'action': f'Increase budget from ${budget:,.0f} to ${better_budget:,.0f}',
                    'impact': f'{would_unlock} more universities become affordable',
                })

        return suggestions

    def _generate_recommendation(self, prob, gpa, ielts, gre, sat, research, eca, budget):
        if prob >= 80:
            msg = "Strong profile! You have excellent chances at your top matches."
        elif prob >= 65:
            msg = "Good profile with solid chances at many universities."
        elif prob >= 50:
            msg = "Moderate chances. Consider strengthening your profile."
        else:
            msg = "Your profile needs improvement for competitive programs."

        tips = []
        if gpa < 3.0:
            tips.append("Improving your GPA would significantly boost your chances")
        if ielts < 6.5:
            tips.append("An IELTS score of 6.5+ would help meet most university requirements")
        if gre == 0:
            tips.append("Taking the GRE can open more options, especially for US universities")
        if research == 0:
            tips.append("Adding research experience can differentiate your application")
        if eca <= 1:
            tips.append("Extracurricular involvement strengthens your overall profile")
        if budget < 20000:
            tips.append("A higher budget opens more university options")

        if tips:
            msg += " Tips: " + "; ".join(tips) + "."
        return msg

    def get_feature_importances(self) -> list:
        if self.feature_importances is not None:
            # Only return top 15 meaningful features
            top = self.feature_importances.head(15)
            return [
                {'feature': row['Feature'], 'importance': round(float(row['Importance']) * 100, 1)}
                for _, row in top.iterrows()
            ]
        return []
