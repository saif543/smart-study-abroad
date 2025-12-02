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

app = Flask(__name__)
CORS(app)

def get_extractor():
    return DataExtractor(claude_path="claude.cmd")

def get_db():
    return MongoDBHandler()


@app.route('/api/search', methods=['POST'])
def search():
    """Search for university data - cache first, then AI"""
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

        return jsonify(result)
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
    """Find universities matching user requirements"""
    try:
        data = request.json
        degree = data.get('degree', 'Master')
        field = data.get('field', '')
        max_tuition = data.get('maxTuition', '')
        min_gpa = data.get('minGPA', '')
        english_test = data.get('englishTest', 'TOEFL')
        english_score = data.get('englishScore', '')
        country = data.get('country', 'USA')
        prefer_scholarship = data.get('preferScholarship', False)

        if not field:
            return jsonify({'error': 'Please provide a field of study'})

        # Build prompt for Claude
        prompt = f"""Find 5 universities for a student with these requirements:
- Degree: {degree}
- Field: {field}
- Maximum Tuition: {max_tuition or 'No limit'}
- GPA: {min_gpa or 'Not specified'}
- English Test: {english_test} with score {english_score or 'Not taken yet'}
- Preferred Country: {country}
- Needs Scholarship: {'Yes' if prefer_scholarship else 'No preference'}

For each university, provide:
1. University name
2. Match score (0-100%)
3. Tuition fees
4. Application deadline
5. Requirements summary
6. Why this is a good match

Format your response as JSON array:
[{{"name": "University Name", "match_score": 85, "tuition": "$50,000/year", "deadline": "January 1", "requirements": "TOEFL 100, GPA 3.5", "why_matched": "Reason..."}}]

Only return the JSON array, no other text."""

        # Call Claude
        result = subprocess.run(
            ["claude.cmd", "--print", "--dangerously-skip-permissions", "-p", prompt],
            capture_output=True,
            text=True,
            timeout=120
        )

        response_text = result.stdout.strip()

        # Try to parse JSON from response
        try:
            # Find JSON array in response
            start = response_text.find('[')
            end = response_text.rfind(']') + 1
            if start != -1 and end > start:
                json_str = response_text[start:end]
                universities = json.loads(json_str)
                return jsonify({'universities': universities})
            else:
                return jsonify({'error': 'Could not parse AI response', 'raw': response_text})
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid JSON in AI response', 'raw': response_text})

    except subprocess.TimeoutExpired:
        return jsonify({'error': 'AI search timed out. Please try again.'})
    except Exception as e:
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
    print("Starting SmartStudy Abroad API Server...")
    print("Available endpoints:")
    print("  POST /api/search - Search university data")
    print("  POST /api/fetch_all - Fetch all data points")
    print("  POST /api/findme - Find universities for requirements")
    print("  POST /api/chat - Chat with AI")
    print("  GET /api/programs - Get stored programs")
    print("  GET /api/health - Health check")
    print("")
    app.run(host='0.0.0.0', port=5000, debug=True)
