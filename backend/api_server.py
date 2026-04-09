"""
Flask API Server for SmartStudy Abroad
Provides REST API endpoints for the Next.js frontend
"""

from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from datetime import datetime
from data_extractor import DataExtractor
from mongodb_handler import MongoDBHandler
import json

# RAG imports for "Find For Me" feature
from rag.matcher import UniversityMatcher

# ML import for admission prediction
from ml.predictor import AdmissionPredictor

# Ollama import for local LLM chatbot
from ollama_handler import OllamaChat

# Initialize RAG matcher globally (loads model once at startup)
print("Loading RAG matcher... (this may take a moment on first run)")
rag_matcher = None
try:
    rag_matcher = UniversityMatcher()
    print("RAG matcher loaded successfully!")
except Exception as e:
    print(f"Warning: RAG matcher failed to load: {e}")
    print("Find For Me feature will use Claude CLI fallback")

# Initialize ML admission predictor
print("Loading ML admission predictor...")
ml_predictor = None
try:
    ml_predictor = AdmissionPredictor()
    print("ML predictor loaded successfully!")
except Exception as e:
    print(f"Warning: ML predictor failed to load: {e}")
    print("Admission prediction feature will be unavailable")

# Initialize Ollama chatbot (local LLM)
print("Connecting to Ollama (local LLM)...")
ollama_chat = OllamaChat(model="mistral:instruct")
ollama_available, ollama_status = ollama_chat.is_available()
if ollama_available:
    print(f"Ollama: CONNECTED ({ollama_status})")
else:
    print(f"Ollama: NOT AVAILABLE - {ollama_status}")
    print("Chat will show an error until Ollama is started.")

app = Flask(__name__)
CORS(app)

def get_extractor():
    return DataExtractor(claude_path="claude.cmd")

def get_db():
    return MongoDBHandler()


@app.route('/api/search', methods=['POST'])
def search():
    """Search for university data - cache first, then AI

    Returns format expected by frontend:
    - source: 'cache' or 'claude' or 'error'
    - data: dict of all 7 data points
    - descriptive: detailed explanation text
    - data_year: year of the data
    - official_name: official university name
    """
    try:
        data = request.json
        university = data.get('university', '')
        degree = data.get('degree', 'Master')
        field = data.get('field', '')
        question = data.get('question', 'tuition fees')

        if not university or not field:
            return jsonify({'source': 'error', 'error': 'Missing university or field'})

        extractor = get_extractor()
        result = extractor.search_and_store(university, degree, field, question)
        extractor.close()

        # Transform response to match frontend expectations
        response = {
            'source': result.get('source', 'error'),
            'data': result.get('all_data', {}),  # All 7 data points
            'descriptive': result.get('full_response', ''),  # Detailed explanation
            'data_year': result.get('data_year'),
            'official_name': result.get('official_name'),
            'key_data': result.get('key_data'),  # The specific answer requested
            'query_type': result.get('query_type')
        }

        # If from cache, get all data from DB
        if result.get('source') == 'cache' and not response['data']:
            db = get_db()
            all_data = db.find_program_all_data(university, degree, field)
            db.close()
            if all_data:
                response['data'] = all_data
                response['data_year'] = all_data.get('data_year')

        return jsonify(response)
    except Exception as e:
        return jsonify({'source': 'error', 'error': str(e)})


@app.route('/api/fetch_all', methods=['POST'])
def fetch_all():
    """Fetch all 7 data points for a program"""
    try:
        data = request.json
        university = data.get('university', '')
        degree = data.get('degree', 'Master')
        field = data.get('field', '')
        force_refresh = data.get('force_refresh', False)

        if not university or not field:
            return jsonify({'source': 'error', 'error': 'Missing university or field'})

        extractor = get_extractor()

        if force_refresh:
            result = extractor.force_fetch_all_data(university, degree, field)
        else:
            result = extractor.fetch_all_data(university, degree, field)

        extractor.close()

        return jsonify(result)
    except Exception as e:
        return jsonify({'source': 'error', 'error': str(e)})


@app.route('/api/findme', methods=['POST'])
def find_for_me():
    """Find universities: ML scores all 232 -> RAG enriches top results.

    Pipeline (Option B):
    1. ML (GradientBoosting) predicts match scores for ALL 232 universities
    2. Take top results ranked by admission probability
    3. RAG (ChromaDB) enriches each with detailed info:
       deadlines, scholarships, research focus, program details, etc.
    4. Return combined ML scores + RAG enrichment
    """
    try:
        data = request.json
        field = data.get('field', '')

        if not field:
            return jsonify({'error': 'Please provide a field of study'})

        if ml_predictor is None:
            return jsonify({'error': 'ML predictor not loaded. Please restart the server.'}), 503

        # --- Step 1: Build student profile for ML ---
        english_test = data.get('englishTest', 'TOEFL')
        english_score = data.get('englishScore', '')
        country = data.get('country', '')

        student_profile = {
            'gpa': float(data.get('minGPA') or 0),
            'ielts': float(english_score or 0) if english_test == 'IELTS' else 0,
            'gre': float(data.get('gre') or 0),
            'sat': float(data.get('sat') or 0),
            'research_exp': 1 if data.get('researchExp') in ('Yes', '1', 1, True) else 0,
            'eca_level': int(data.get('ecaLevel') or 0),
            'budget': float(data.get('maxTuition') or 0),
            'field': field,
            'preferred_country': country if country and country != 'Any' else '',
        }

        top_k = int(data.get('top_k', 5))

        # --- Step 2: ML scores ALL 232 universities ---
        # Get top_k for display, but top 30 for chat context (so LLM knows more universities)
        chat_k = max(top_k, 30)
        ml_result = ml_predictor.match_top_universities(student_profile, top_k=chat_k)

        # --- Step 3: RAG enrichment — look up each university in ChromaDB ---
        rag_lookup = {}
        if rag_matcher:
            try:
                all_docs = rag_matcher.vector_store.get_all_documents()
                for i, meta in enumerate(all_docs['metadatas']):
                    name = (meta.get('university') or '').strip().lower()
                    if name:
                        rag_lookup[name] = meta
                print(f"RAG enrichment: {len(rag_lookup)} universities available")
            except Exception as e:
                print(f"RAG enrichment lookup failed (non-critical): {e}")

        # --- Step 4: Merge ML results + RAG enrichment ---
        universities = []
        for u in ml_result.get('universities', []):
            uni_name = u['university_name']
            rag = rag_lookup.get(uni_name.strip().lower(), {})

            tuition = u.get('tuition_fee', 0)
            tuition_str = f"${tuition:,.0f}/year" if tuition else 'Contact school'

            universities.append({
                # ML prediction data
                'name': uni_name,
                'country': u['country'],
                'match_score': u['admission_probability'],
                'category': u['category'],
                'qs_ranking': u.get('qs_ranking'),
                'min_gpa': u.get('min_gpa', 0),
                'ielts_requirement': u.get('ielts_requirement', 0),
                'tuition_fee': tuition,
                'tuition': tuition_str,
                'acceptance_rate': u.get('acceptance_rate'),
                'scholarship_available': u.get('scholarship_available', False),
                'subject_match': u.get('subject_match', False),
                'gap_analysis': u.get('gap_analysis', []),
                'is_preferred': u.get('is_preferred', 0),
                # RAG enrichment data (detailed info from ChromaDB)
                'field': rag.get('field', field),
                'degree': rag.get('degree', data.get('degree', 'Master')),
                'ielts': rag.get('ielts', 0),
                'toefl': rag.get('toefl', 0),
                'scholarships': rag.get('scholarships', ''),
                'deadline_fall': rag.get('deadline_fall', ''),
                'deadline_spring': rag.get('deadline_spring', ''),
                'test_requirements': rag.get('test_requirements', ''),
                'program_duration': rag.get('program_duration', ''),
                'english_requirements': rag.get('english_requirements', ''),
                'living_cost': rag.get('living_cost', 0),
                'total_cost_estimated': rag.get('total_cost_estimated', 0),
                'max_coverage_percent': rag.get('max_coverage_percent', 0),
                'work_visa_available': rag.get('work_visa_available', 0),
                'research_weight': rag.get('research_weight', 0),
                'eca_weight': rag.get('eca_weight', 0),
                'research_focus': rag.get('research_focus', ''),
                'programs_offered': rag.get('programs_offered', ''),
                'rag_enriched': bool(rag),  # Flag: did RAG find this university?
            })

        # Split: display top_k, chat gets all 30
        display_universities = universities[:top_k]

        # Build rich chat context with ML summary + student profile
        chat_context = {
            'student_profile': student_profile,
            'ml_summary': {
                'overall_probability': ml_result.get('ml_prediction', {}).get('ml_probability', 0),
                'confidence': ml_result.get('ml_prediction', {}).get('confidence', ''),
                'recommendation': ml_result.get('recommendation', ''),
                'category_counts': ml_result.get('category_counts', {}),
                'improvements': ml_result.get('improvements', []),
                'total_universities': ml_result.get('total_in_dataset', 0),
            },
            'shown_universities': display_universities,      # Top 5 on screen
            'extra_universities': universities[top_k:],       # 6-30 for chat to recommend
        }

        return jsonify({
            'universities': display_universities,
            'ml_prediction': ml_result.get('ml_prediction', {}),
            'recommendation': ml_result.get('recommendation', ''),
            'category_counts': ml_result.get('category_counts', {}),
            'improvements': ml_result.get('improvements', []),
            'total_in_database': ml_result.get('total_in_dataset', 0),
            'chat_context': chat_context,
            'source': 'ml+rag',
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)})


@app.route('/api/chat', methods=['POST'])
def chat():
    """Chat with local Ollama LLM (Mistral 7B)

    Accepts:
        message: str - the user's current message
        history: list - prior messages [{role: 'user'|'assistant', content: '...'}]
        rag_context: list - latest FindForMe results (university dicts)

    The system prompt guardrails the LLM to university topics only.
    RAG context is injected so the LLM can explain search results.
    """
    try:
        data = request.json
        message = data.get('message', '')
        history = data.get('history', [])
        rag_context = data.get('rag_context', None)

        if not message:
            return jsonify({'response': 'Please provide a message'})

        # AUTO RAG: If user has no search results but asks about universities,
        # use Mistral to understand the message (handles typos, slang, etc.)
        # then automatically run a RAG search with the extracted preferences
        if not rag_context and rag_matcher:
            try:
                # Step 1: Ask Mistral to extract structured preferences
                # e.g., "compter sience in caneda" → {field: "Computer Science", country: "Canada"}
                auto_prefs = ollama_chat.extract_preferences(message)

                if auto_prefs and auto_prefs.get('field'):
                    print(f"Auto RAG: Mistral extracted preferences: {auto_prefs}")

                    # Build RAG search preferences
                    search_prefs = {
                        'field': auto_prefs['field'],
                        'degree': auto_prefs.get('degree', 'Master'),
                        'budget': auto_prefs.get('budget', 0),
                        'gpa': auto_prefs.get('gpa', 0),
                        'free_text': auto_prefs.get('free_text', message),
                    }
                    if auto_prefs.get('country'):
                        search_prefs['country'] = auto_prefs['country']

                    # Step 2: Run RAG search with clean preferences
                    auto_results = rag_matcher.find_matches(search_prefs, top_k=5)
                    if auto_results:
                        rag_context = []
                        for r in auto_results:
                            rag_context.append({
                                'name': r['university'],
                                'country': r['country'],
                                'match_score': r['match_percentage'],
                                'tuition': f"${r['tuition_fees']:,.0f}/year" if r['tuition_fees'] else 'N/A',
                                'field': r['field'],
                                'degree': r['degree'],
                                'gpa_required': r['gpa_requirement'],
                                'ielts': r.get('ielts', 0),
                                'toefl': r.get('toefl', 0),
                                'scholarships': r.get('scholarships', ''),
                                'qs_ranking': r.get('qs_ranking', ''),
                                'reasons': r.get('reasons', []),
                            })
                        print(f"Auto RAG: Found {len(rag_context)} universities")
            except Exception as e:
                print(f"Auto RAG failed (non-critical): {e}")

        # Call local Ollama LLM
        result = ollama_chat.chat(
            message=message,
            history=history,
            rag_context=rag_context
        )

        return jsonify(result)

    except Exception as e:
        return jsonify({'response': f'Error: {str(e)}'})


@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    """Streaming chat — sends tokens as they arrive from Ollama.

    Returns Server-Sent Events (SSE) so the frontend can show
    the AI "typing" in real-time instead of waiting for the full response.
    """
    data = request.json
    message = data.get('message', '')
    history = data.get('history', [])
    rag_context = data.get('rag_context', None)

    if not message:
        return jsonify({'response': 'Please provide a message'})

    # Auto RAG for chat without context (same as non-streaming)
    if not rag_context and rag_matcher:
        try:
            auto_prefs = ollama_chat.extract_preferences(message)
            if auto_prefs and auto_prefs.get('field'):
                search_prefs = {
                    'field': auto_prefs['field'],
                    'degree': auto_prefs.get('degree', 'Master'),
                    'budget': auto_prefs.get('budget', 0),
                    'gpa': auto_prefs.get('gpa', 0),
                    'free_text': auto_prefs.get('free_text', message),
                }
                if auto_prefs.get('country'):
                    search_prefs['country'] = auto_prefs['country']
                auto_results = rag_matcher.find_matches(search_prefs, top_k=5)
                if auto_results:
                    rag_context = [
                        {'name': r['university'], 'country': r['country'],
                         'match_score': r['match_percentage'],
                         'tuition': f"${r['tuition_fees']:,.0f}/year" if r['tuition_fees'] else 'N/A',
                         'field': r['field'], 'degree': r['degree'],
                         'gpa_required': r['gpa_requirement'],
                         'ielts': r.get('ielts', 0), 'toefl': r.get('toefl', 0),
                         'scholarships': r.get('scholarships', ''),
                         'qs_ranking': r.get('qs_ranking', '')}
                        for r in auto_results
                    ]
        except Exception as e:
            print(f"Auto RAG failed: {e}")

    def generate():
        try:
            for token in ollama_chat.chat_stream(
                message=message, history=history, rag_context=rag_context
            ):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
    )


@app.route('/api/programs', methods=['GET'])
def get_programs():
    """Get all stored programs from database"""
    try:
        db = get_db()
        programs = db.get_all_programs()
        db.close()
        return jsonify({'programs': programs})
    except Exception as e:
        return jsonify({'error': str(e)})


@app.route('/api/cost', methods=['POST'])
def cost():
    """Calculate full cost of study breakdown"""
    try:
        from cost_calculator import calculate, get_countries, get_cities
        body = request.get_json()

        # Meta requests
        if body.get('get_countries'):
            return jsonify({'countries': get_countries()})
        if body.get('get_cities'):
            return jsonify({'cities': get_cities(body['get_cities'])})

        result = calculate(
            tuition_yearly     = float(body.get('tuition_yearly', 0)),
            country            = body.get('country', 'USA'),
            city               = body.get('city', 'default'),
            housing_type       = body.get('housing_type', 'housing_oncampus_shared'),
            meal_plan          = body.get('meal_plan', 'none'),
            program_years      = float(body.get('program_years', 2.0)),
            include_uni_extras = body.get('include_uni_extras', True),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/predict', methods=['POST'])
def predict_admission():
    """Predict admission probability using ML + smart_score matching.

    Input: gpa, ielts, gre, sat, research_exp, eca_level, budget,
           preferred_country, field
    Output: ML probability, top matched universities with category/probability/gap analysis
    """
    try:
        data = request.json

        if ml_predictor is None:
            return jsonify({'error': 'ML predictor not loaded'}), 503

        student_profile = {
            'gpa': data.get('gpa', 0),
            'ielts': data.get('ielts', 0),
            'gre': data.get('gre', 0),
            'sat': data.get('sat', 0),
            'research_exp': data.get('research_exp', 0),
            'eca_level': data.get('eca_level', 0),
            'budget': data.get('budget', 0),
            'preferred_country': data.get('preferred_country', ''),
            'field': data.get('field', ''),
        }

        top_k = int(data.get('top_k', 10))
        result = ml_predictor.match_top_universities(student_profile, top_k=top_k)

        return jsonify({**result, 'source': 'ml'})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/predict/features', methods=['GET'])
def get_feature_importances():
    """Return ML model feature importances for visualization"""
    if ml_predictor is None:
        return jsonify({'error': 'ML predictor not loaded'}), 503
    return jsonify({
        'features': ml_predictor.get_feature_importances()
    })


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'service': 'SmartStudy Abroad API',
        'ml_predictor': 'loaded' if ml_predictor else 'unavailable'
    })


if __name__ == '__main__':
    print("\n" + "="*60)
    print("SmartStudy Abroad API Server")
    print("="*60)
    print("\nAvailable endpoints:")
    print("  POST /api/search    - Search university data (Claude AI)")
    print("  POST /api/fetch_all - Fetch all data points")
    print("  POST /api/findme    - Find universities (RAG - FAST, LOCAL)")
    print("  POST /api/predict   - Admission probability (ML - Random Forest)")
    print("  GET  /api/predict/features - ML feature importances")
    print("  POST /api/chat      - Chat with Ollama (LOCAL LLM)")
    print("  GET  /api/programs  - Get stored programs")
    print("  GET  /api/health    - Health check")
    print("")
    print("RAG Status:", "ENABLED" if rag_matcher else "DISABLED")
    print("ML  Status:", "ENABLED" if ml_predictor else "DISABLED")
    if rag_matcher:
        print(f"Universities in database: {rag_matcher.vector_store.get_count()}")
    print("Ollama Status:", "CONNECTED" if ollama_available else "NOT AVAILABLE")
    print("="*60 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
