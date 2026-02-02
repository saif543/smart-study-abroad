"""
Flask API Server for SmartStudy Abroad
Provides REST API endpoints for the Next.js frontend
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from data_extractor import DataExtractor
from mongodb_handler import MongoDBHandler
import subprocess
import json

# RAG imports for "Find For Me" feature
from rag.matcher import UniversityMatcher

# Initialize RAG matcher globally (loads model once at startup)
print("Loading RAG matcher... (this may take a moment on first run)")
rag_matcher = None
try:
    rag_matcher = UniversityMatcher()
    print("RAG matcher loaded successfully!")
except Exception as e:
    print(f"Warning: RAG matcher failed to load: {e}")
    print("Find For Me feature will use Claude CLI fallback")

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
    """Find universities matching user requirements using RAG

    Uses semantic search + criteria matching to find best universities.
    Returns match percentages based on:
    - 40% semantic similarity (meaning match)
    - 60% criteria fit (budget, GPA, field)
    """
    try:
        data = request.json
        degree = data.get('degree', 'Master')
        field = data.get('field', '')
        max_tuition = data.get('maxTuition', '')
        min_gpa = data.get('minGPA', '')
        english_test = data.get('englishTest', 'TOEFL')
        english_score = data.get('englishScore', '')
        country = data.get('country', '')  # Empty = any country
        prefer_scholarship = data.get('preferScholarship', False)
        top_k = data.get('top_k', 3)  # Number of results to return

        if not field:
            return jsonify({'error': 'Please provide a field of study'})

        # Check if RAG matcher is available
        if rag_matcher is None:
            return jsonify({'error': 'RAG system not initialized. Please restart the server.'})

        # Prepare preferences for RAG matcher
        preferences = {
            'field': field,
            'degree': degree,
            'budget': float(max_tuition) if max_tuition else 100000,  # Default high budget
            'gpa': float(min_gpa) if min_gpa else 4.0,  # Default high GPA
        }

        # Only filter by country if specified
        if country and country != 'Any':
            preferences['country'] = country

        # Find matches using RAG
        results = rag_matcher.find_matches(preferences, top_k=int(top_k))

        # Format results for frontend
        universities = []
        for result in results:
            universities.append({
                'name': result['university'],
                'country': result['country'],
                'match_score': result['match_percentage'],
                'tuition': f"${result['tuition_fees']:,.0f}/year" if result['tuition_fees'] else 'Contact school',
                'field': result['field'],
                'degree': result['degree'],
                'gpa_required': result['gpa_requirement'],
                'score_breakdown': result['score_breakdown'],
                'reasons': result.get('reasons', []),
                'why_matched': f"Semantic match: {result['score_breakdown']['semantic_similarity']}%, Budget fit: {result['score_breakdown']['budget_fit']}%, GPA fit: {result['score_breakdown']['gpa_fit']}%"
            })

        return jsonify({
            'universities': universities,
            'source': 'rag',
            'total_in_database': rag_matcher.vector_store.get_count()
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)})


@app.route('/api/chat', methods=['POST'])
def chat():
    """Chat with AI assistant"""
    try:
        data = request.json
        message = data.get('message', '')

        if not message:
            return jsonify({'response': 'Please provide a message'})

        # Build prompt
        prompt = f"""You are a helpful assistant for students looking to study abroad.
Answer this question concisely:

{message}

Keep your response brief and helpful. If asking about specific universities,
mention that the user can use the Search tab for detailed information."""

        # Call Claude
        result = subprocess.run(
            ["claude.cmd", "--print", "--dangerously-skip-permissions", "-p", prompt],
            capture_output=True,
            text=True,
            timeout=60
        )

        response_text = result.stdout.strip()
        return jsonify({'response': response_text})

    except subprocess.TimeoutExpired:
        return jsonify({'response': 'Sorry, the AI took too long to respond. Please try again.'})
    except Exception as e:
        return jsonify({'response': f'Error: {str(e)}'})


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


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'service': 'SmartStudy Abroad API'
    })


if __name__ == '__main__':
    print("\n" + "="*60)
    print("SmartStudy Abroad API Server")
    print("="*60)
    print("\nAvailable endpoints:")
    print("  POST /api/search    - Search university data (Claude AI)")
    print("  POST /api/fetch_all - Fetch all data points")
    print("  POST /api/findme    - Find universities (RAG - FAST, LOCAL)")
    print("  POST /api/chat      - Chat with AI")
    print("  GET  /api/programs  - Get stored programs")
    print("  GET  /api/health    - Health check")
    print("")
    print("RAG Status:", "ENABLED" if rag_matcher else "DISABLED")
    if rag_matcher:
        print(f"Universities in database: {rag_matcher.vector_store.get_count()}")
    print("="*60 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
