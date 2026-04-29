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

# Ollama import for local LLM chatbot
from ollama_handler import OllamaChat

import pandas as pd
import os

# Initialize Ollama chatbot (local LLM) — loaded first so RAG matcher can use it
print("Connecting to Ollama (local LLM)...")
ollama_chat = OllamaChat(model="mistral:instruct")
ollama_available, ollama_status = ollama_chat.is_available()
if ollama_available:
    print(f"Ollama: CONNECTED ({ollama_status})")
else:
    print(f"Ollama: NOT AVAILABLE - {ollama_status}")
    print("Chat will show an error until Ollama is started.")

# Initialize RAG matcher globally (loads model once at startup)
# Pass ollama_chat so matcher can use LLM for weight extraction
print("Loading RAG matcher... (this may take a moment on first run)")
rag_matcher = None
try:
    rag_matcher = UniversityMatcher(ollama_chat=ollama_chat if ollama_available else None)
    print("RAG matcher loaded successfully!")
except Exception as e:
    print(f"Warning: RAG matcher failed to load: {e}")
    print("Find For Me feature will use Claude CLI fallback")

# Load university dataset for chatbot name lookup
university_df = None
try:
    csv_path = os.path.join(os.path.dirname(__file__), 'ml', 'university_dataset_multilabel.csv')
    university_df = pd.read_csv(csv_path)
    print(f"University dataset loaded: {len(university_df)} universities")
except Exception as e:
    print(f"Warning: University dataset failed to load: {e}")

app = Flask(__name__)
CORS(app)

def get_extractor():
    return DataExtractor(claude_path="claude")

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

        # If from cache, get all data from DB (only if MongoDB available)
        if result.get('source') == 'cache' and not response['data']:
            try:
                db = get_db()
                all_data = db.find_program_all_data(university, degree, field)
                db.close()
                if all_data:
                    response['data'] = all_data
                    response['data_year'] = all_data.get('data_year')
            except Exception:
                pass  # MongoDB not available

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
    """Find universities using RAG semantic search.

    Pipeline:
    1. ChromaDB vector search (cosine similarity)
    2. BM25 keyword search
    3. Reciprocal Rank Fusion (merges both)
    4. Cross-encoder re-ranking
    5. Criteria scoring (budget, GPA, field, English, scholarships)
    """
    try:
        data = request.json
        field = data.get('field', '')

        if not field:
            return jsonify({'error': 'Please provide a field of study'})

        if rag_matcher is None:
            return jsonify({'error': 'RAG matcher not loaded. Please restart the server.'}), 503

        # Build preferences for RAG matcher
        country = data.get('country', '')
        preferences = {
            'field': field,
            'degree': data.get('degree', 'Master'),
            'budget': float(data.get('maxTuition') or 0),
            'gpa': float(data.get('minGPA') or 0),
            'english_test': data.get('englishTest', ''),
            'english_score': data.get('englishScore', ''),
            'prefer_scholarship': data.get('preferScholarship', False),
            'free_text': data.get('freeText', ''),
        }
        if country and country != 'Any':
            preferences['country'] = country

        # Student research strength (publications, thesis, lab experience)
        # Boosts match score for research-heavy universities.
        student_research = data.get('student_research') or {}
        if student_research:
            preferences['student_research'] = {
                'experience': student_research.get('experience', 'none'),
                'thesis_count': int(student_research.get('thesis_count', 0) or 0),
                'publication_count': int(student_research.get('publication_count', 0) or 0),
            }

        top_k = int(data.get('top_k', 5))

        # RAG search
        results = rag_matcher.find_matches(preferences, top_k=top_k)

        # Format results for frontend
        universities = []
        for r in results:
            tuition = r.get('tuition_fees', 0)
            universities.append({
                'name': r['university'],
                'country': r['country'],
                'match_score': r['match_percentage'],
                'field': r.get('field', field),
                'degree': r.get('degree', ''),
                'tuition': f"${tuition:,.0f}/year" if tuition else 'Contact school',
                'tuition_fees': tuition,
                'gpa_required': r.get('gpa_requirement', 0),
                'ielts': r.get('ielts', 0),
                'toefl': r.get('toefl', 0),
                'scholarships': r.get('scholarships', ''),
                'deadline_fall': r.get('deadline_fall', ''),
                'deadline_spring': r.get('deadline_spring', ''),
                'test_requirements': r.get('test_requirements', ''),
                'program_duration': r.get('program_duration', ''),
                'english_requirements': r.get('english_requirements', ''),
                'qs_ranking': r.get('qs_ranking', ''),
                'acceptance_rate': r.get('acceptance_rate', 0),
                'fit_label': r.get('fit_label', ''),
                'requirement_checks': r.get('requirement_checks', []),
                'living_cost': r.get('living_cost', 0),
                'total_cost_estimated': r.get('total_cost_estimated', 0),
                'max_coverage_percent': r.get('max_coverage_percent', 0),
                'work_visa_available': r.get('work_visa_available', 0),
                'research_weight': r.get('research_weight', 0),
                'eca_weight': r.get('eca_weight', 0),
                'research_focus': r.get('research_focus', ''),
                'programs_offered': r.get('programs_offered', ''),
                'score_breakdown': r.get('score_breakdown', {}),
                'reasons': r.get('reasons', []),
            })

        return jsonify({
            'universities': universities,
            'total_in_database': rag_matcher.vector_store.get_count(),
            'source': 'rag',
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)})


def _format_rag_results(results):
    """Format RAG matcher results into context dicts for chatbot."""
    context = []
    for r in results:
        context.append({
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
            'acceptance_rate': r.get('acceptance_rate', ''),
            'living_cost': r.get('living_cost', 0),
            'total_cost_estimated': r.get('total_cost_estimated', 0),
            'research_focus': r.get('research_focus', ''),
            'work_visa_available': r.get('work_visa_available', ''),
            'reasons': r.get('reasons', []),
        })
    return context


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
        user_profile = data.get('user_profile', None)

        if not message:
            return jsonify({'response': 'Please provide a message'})

        # AUTO SEARCH: If user has no search results, try two approaches:
        # 1. Direct university lookup — "tell me about MIT" → search dataset
        # 2. RAG search — "find me cheap CS in Canada" → full RAG pipeline
        if not rag_context:
            try:
                # Step 1: Try direct university lookup from ML dataset
                if university_df is not None:
                    uni_matches = ollama_chat.search_university_info(message, university_df)
                    if uni_matches:
                        rag_context = uni_matches
                        print(f"Direct search: Found {len(uni_matches)} matching universities")

                # Step 2: If no direct match, try RAG search via LLM preference extraction
                if not rag_context and rag_matcher:
                    auto_prefs = ollama_chat.extract_preferences(message)

                    if auto_prefs and auto_prefs.get('field'):
                        print(f"Auto RAG: Mistral extracted preferences: {auto_prefs}")

                        search_prefs = {
                            'field': auto_prefs['field'],
                            'degree': auto_prefs.get('degree', 'Master'),
                            'budget': auto_prefs.get('budget', 0),
                            'gpa': auto_prefs.get('gpa', 0),
                            'free_text': auto_prefs.get('free_text', message),
                        }
                        if auto_prefs.get('country'):
                            search_prefs['country'] = auto_prefs['country']

                        auto_results = rag_matcher.find_matches(search_prefs, top_k=10)
                        if auto_results:
                            rag_context = _format_rag_results(auto_results)
                            print(f"Auto RAG: Found {len(rag_context)} universities")

                # Step 3: Fallback — direct ChromaDB vector search with raw message
                if not rag_context and rag_matcher and rag_matcher.vector_store:
                    try:
                        query_emb = rag_matcher.embedder.model.encode([message])[0]
                        raw_results = rag_matcher.vector_store.search(query_emb, top_k=10)
                        if raw_results:
                            seen = set()
                            rag_context = []
                            for r in raw_results:
                                m = r.get('metadata', {})
                                uni_name = m.get('university', '')
                                if uni_name in seen:
                                    continue
                                seen.add(uni_name)
                                rag_context.append({
                                    'name': uni_name,
                                    'country': m.get('country', ''),
                                    'match_score': round(r.get('score', 0) * 100, 1),
                                    'tuition': f"${m['tuition_fees']:,.0f}/year" if m.get('tuition_fees') else 'N/A',
                                    'field': m.get('field', ''),
                                    'degree': m.get('degree', ''),
                                    'gpa_required': m.get('gpa_requirement', ''),
                                    'ielts': m.get('ielts', 0),
                                    'toefl': m.get('toefl', 0),
                                    'scholarships': m.get('scholarships', ''),
                                    'qs_ranking': m.get('qs_ranking', ''),
                                    'acceptance_rate': m.get('acceptance_rate', ''),
                                    'living_cost': m.get('living_cost', 0),
                                    'total_cost_estimated': m.get('total_cost_estimated', 0),
                                    'research_focus': m.get('research_focus', ''),
                                    'work_visa_available': m.get('work_visa_available', ''),
                                })
                            print(f"Direct ChromaDB search: Found {len(rag_context)} universities")
                    except Exception as e2:
                        print(f"Direct ChromaDB search failed: {e2}")
            except Exception as e:
                print(f"Auto search failed (non-critical): {e}")

        # Call local Ollama LLM
        result = ollama_chat.chat(
            message=message,
            history=history,
            rag_context=rag_context,
            user_profile=user_profile,
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

    # Auto search for chat without context (same logic as non-streaming)
    if not rag_context:
        try:
            # Direct university lookup first
            if university_df is not None:
                uni_matches = ollama_chat.search_university_info(message, university_df)
                if uni_matches:
                    rag_context = uni_matches

            # Then try RAG search
            if not rag_context and rag_matcher:
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
            print(f"Auto search failed: {e}")

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


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'service': 'SmartStudy Abroad API',
        'university_db': f'{len(university_df)} universities' if university_df is not None else 'unavailable'
    })


if __name__ == '__main__':
    print("\n" + "="*60)
    print("SmartStudy Abroad API Server")
    print("="*60)
    print("\nAvailable endpoints:")
    print("  POST /api/search    - Search university data (Claude AI)")
    print("  POST /api/fetch_all - Fetch all data points")
    print("  POST /api/findme    - Find universities (RAG - FAST, LOCAL)")
    print("  POST /api/chat      - Chat with Ollama (LOCAL LLM)")
    print("  GET  /api/programs  - Get stored programs")
    print("  GET  /api/health    - Health check")
    print("")
    print("RAG Status:", "ENABLED" if rag_matcher else "DISABLED")
    if rag_matcher:
        print(f"Universities in database: {rag_matcher.vector_store.get_count()}")
    print("Ollama Status:", "CONNECTED" if ollama_available else "NOT AVAILABLE")
    print("="*60 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
