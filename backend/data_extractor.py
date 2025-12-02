"""
Data Extractor
Extracts ONLY key data points from Claude responses
Stores structured data in MongoDB
"""

import subprocess
import tempfile
import os
import json
import re
from datetime import datetime
from mongodb_handler import MongoDBHandler


class DataExtractor:
    """Extract and store only key data points from Claude"""

    def __init__(self, claude_path="claude.cmd"):
        self.claude_path = claude_path
        self.db = MongoDBHandler()

        # Map common questions to query types
        self.query_type_map = {
            "tuition": "tuition_fees",
            "fee": "tuition_fees",
            "cost": "tuition_fees",
            "admission": "admission_requirements",
            "requirement": "admission_requirements",
            "eligibility": "admission_requirements",
            "deadline": "deadline_fall",
            "apply": "deadline_fall",
            "scholarship": "scholarships",
            "financial": "scholarships",
            "ielts": "english_requirements",
            "toefl": "english_requirements",
            "english": "english_requirements",
            "gre": "test_requirements",
            "gmat": "test_requirements",
            "duration": "program_duration",
            "year": "program_duration",
            "rank": "ranking",
            "ranking": "ranking",
            "job": "career_prospects",
            "career": "career_prospects",
            "placement": "career_prospects"
        }

    # Map query types to related database fields
    related_fields_map = {
        "requirement": ["english_requirements", "gpa_requirement", "test_requirements", "admission_requirements"],
        "admission_requirements": ["english_requirements", "gpa_requirement", "test_requirements"],
        "tuition_fees": ["tuition_fees"],
        "deadline": ["deadline_spring", "deadline_summer", "deadline_fall"],
        "deadline_fall": ["deadline_fall", "deadline_spring", "deadline_summer"],
        "scholarships": ["scholarships"],
        "english_requirements": ["english_requirements"],
        "test_requirements": ["test_requirements", "gpa_requirement"],
        "program_duration": ["program_duration"],
        "ranking": ["ranking"],
        "career_prospects": ["career_prospects"],
    }

    def detect_query_type(self, question):
        """Detect what type of information is being asked"""
        question_lower = question.lower()

        for keyword, query_type in self.query_type_map.items():
            if keyword in question_lower:
                return query_type

        return "general_info"
    
    def find_related_cached_data(self, university, degree, field, question):
        """
        Smart cache lookup - find related fields based on question.
        Returns cached data if ANY related field exists.
        """
        question_lower = question.lower()
        
        # Get all stored data for this program
        all_data = self.db.find_program_all_data(university, degree, field)
        if not all_data:
            return None
        
        # Find which fields are relevant to this question
        relevant_data = {}
        
        # Check for requirement-related questions
        if any(word in question_lower for word in ["requirement", "admission", "eligibility", "need", "criteria"]):
            for key in ["english_requirements", "gpa_requirement", "test_requirements"]:
                if key in all_data and all_data[key]:
                    relevant_data[key] = all_data[key]
        
        # Check for deadline-related questions
        if any(word in question_lower for word in ["deadline", "apply", "application", "when"]):
            for key in ["deadline_spring", "deadline_summer", "deadline_fall"]:
                if key in all_data and all_data[key]:
                    relevant_data[key] = all_data[key]
        
        # Check for cost-related questions
        if any(word in question_lower for word in ["tuition", "fee", "cost", "price", "expense"]):
            if "tuition_fees" in all_data and all_data["tuition_fees"]:
                relevant_data["tuition_fees"] = all_data["tuition_fees"]
        
        # Check for scholarship questions
        if any(word in question_lower for word in ["scholarship", "financial", "aid", "funding"]):
            if "scholarships" in all_data and all_data["scholarships"]:
                relevant_data["scholarships"] = all_data["scholarships"]
        
        # Check for duration questions
        if any(word in question_lower for word in ["duration", "long", "year", "semester", "time"]):
            if "program_duration" in all_data and all_data["program_duration"]:
                relevant_data["program_duration"] = all_data["program_duration"]
        
        # Check for English/language questions
        if any(word in question_lower for word in ["english", "ielts", "toefl", "language"]):
            if "english_requirements" in all_data and all_data["english_requirements"]:
                relevant_data["english_requirements"] = all_data["english_requirements"]
        
        # Check for GRE/GMAT questions
        if any(word in question_lower for word in ["gre", "gmat", "test score"]):
            if "test_requirements" in all_data and all_data["test_requirements"]:
                relevant_data["test_requirements"] = all_data["test_requirements"]
        
        # Check for GPA questions
        if any(word in question_lower for word in ["gpa", "cgpa", "grade"]):
            if "gpa_requirement" in all_data and all_data["gpa_requirement"]:
                relevant_data["gpa_requirement"] = all_data["gpa_requirement"]
        
        # Add data_year if we found relevant data
        if relevant_data:
            if "data_year" in all_data:
                relevant_data["data_year"] = all_data["data_year"]
            return relevant_data
        
        return None

    def search_and_store(self, university, degree, field, question):
        """
        Search with Claude and store ONLY key data

        Returns:
            dict with key_data and full_response
        """
        query_type = self.detect_query_type(question)

        # SMART CACHE: First check for related fields in database
        smart_cached = self.find_related_cached_data(university, degree, field, question)
        if smart_cached:
            # Format the cached data nicely
            parts = []
            for k, v in smart_cached.items():
                if k != "data_year":
                    parts.append(f"{k.replace('_', ' ').title()}: {v}")
            formatted = " | ".join(parts)
            return {
                "source": "cache",
                "query_type": query_type,
                "key_data": formatted,
                "full_response": "From database: " + formatted,
                "cached_at": None,
                "data_year": smart_cached.get("data_year")
            }
        
        # Fallback: exact field match
        cached = self.db.find_data(university, degree, field, query_type)
        if cached["found"]:
            return {
                "source": "cache",
                "query_type": query_type,
                "key_data": cached["data"],
                "full_response": f"From database: {cached['data']}",
                "cached_at": cached["updated_at"].isoformat() if cached["updated_at"] else None
            }

        # Not in cache - ask Claude for ONLY the key data
        prompt = self._build_extraction_prompt(university, degree, field, question, query_type)

        # Send to Claude
        response = self._send_to_claude(prompt)

        if not response["success"]:
            return {
                "source": "error",
                "query_type": query_type,
                "key_data": None,
                "full_response": response.get("error", "Unknown error"),
                "cached_at": None
            }

        # Extract key data from response
        key_data = self._extract_key_value(response["text"], query_type)

        # Store in database
        if key_data:
            self.db.store_data(university, degree, field, query_type, key_data)

        return {
            "source": "claude",
            "query_type": query_type,
            "key_data": key_data,
            "full_response": response["text"],
            "cached_at": None
        }

    def _build_extraction_prompt(self, university, degree, field, question, query_type):
        """Build prompt that asks Claude to return ONLY key data"""

        type_instructions = {
            "tuition_fees": "Return ONLY the tuition fee amount (e.g., '$61,990 per year' or 'BDT 500,000 per semester'). No extra text.",
            "admission_requirements": "Return ONLY a short list of requirements (e.g., 'CGPA 3.0+, IELTS 6.5, LOR x2'). No paragraphs.",
            "deadline_fall": "Return ONLY the deadline date (e.g., 'January 15, 2025' or 'Rolling admissions'). No extra text.",
            "scholarships": "Return ONLY scholarship names and amounts (e.g., 'Merit: 50% tuition, Need-based: $10,000'). Brief only.",
            "english_requirements": "Return ONLY the score requirements (e.g., 'IELTS 6.5 / TOEFL 90'). No extra text.",
            "test_requirements": "Return ONLY the test scores (e.g., 'GRE 310+ / GMAT 600+'). No extra text.",
            "program_duration": "Return ONLY the duration (e.g., '2 years' or '4 semesters'). No extra text.",
            "ranking": "Return ONLY the ranking (e.g., '#5 in US, #20 World'). No extra text.",
            "career_prospects": "Return ONLY key stats (e.g., '95% placement, Avg salary $120k'). Brief only.",
            "general_info": "Return ONLY the key fact requested in one short line. No paragraphs."
        }

        instruction = type_instructions.get(query_type, type_instructions["general_info"])

        prompt = f"""You are a data extraction assistant. Search for the answer and return ONLY the key data point.

University: {university}
Program: {degree} in {field}
Question: {question}

CRITICAL INSTRUCTIONS:
{instruction}

DO NOT write paragraphs. DO NOT explain. DO NOT add context.
Just give the single key data value.

Example good responses:
- "$55,000 per year"
- "CGPA 3.5+, GRE 320+, IELTS 7.0"
- "December 1, 2024"
- "2 years full-time"

Now search and give ONLY the key data:"""

        return prompt

    def _send_to_claude(self, prompt):
        """Send prompt to Claude CLI"""
        try:
            # Write to temp file
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt', encoding='utf-8') as f:
                f.write(prompt)
                temp_file = f.name

            try:
                command = f'type "{temp_file}" | {self.claude_path} --print --dangerously-skip-permissions'
                result = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    shell=True,
                    timeout=180,
                    encoding='utf-8',
                    errors='ignore'
                )
            finally:
                try:
                    os.unlink(temp_file)
                except:
                    pass

            if result.returncode != 0:
                return {"success": False, "error": result.stderr}

            return {"success": True, "text": result.stdout.strip()}

        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Timeout"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _extract_key_value(self, response_text, query_type):
        """Extract just the key value from Claude's response"""
        if not response_text:
            return None

        # Check for "not found" or "unavailable" responses
        not_found_phrases = [
            "not found", "not available", "couldn't find", "could not find",
            "no information", "unable to find", "don't have", "do not have",
            "not specified", "not provided", "n/a", "unknown"
        ]
        response_lower = response_text.lower()
        for phrase in not_found_phrases:
            if phrase in response_lower:
                return None  # Don't store if info not found

        # Clean up response - take first meaningful line
        lines = response_text.strip().split('\n')

        for line in lines:
            line = line.strip()
            # Skip empty lines and common prefixes
            if not line:
                continue
            if line.lower().startswith(('here', 'the', 'based on', 'according', 'i found', 'i couldn')):
                continue
            if len(line) < 3:
                continue

            # Remove markdown formatting
            line = re.sub(r'\*\*|\*|__|_', '', line)
            line = re.sub(r'^[-•]\s*', '', line)

            # If it looks like data, return it
            if len(line) < 200:  # Key data should be short
                return line

        # Fallback: return first 150 chars if meaningful
        cleaned = response_text[:150].strip()
        if len(cleaned) > 10:
            return cleaned
        return None

    def get_cached_data(self, university, degree, field):
        """Get all cached data for a university program"""
        return self.db.find_program_all_data(university, degree, field)

    def fetch_all_data(self, university, degree, field):
        """
        Fetch ALL 7 key data points at once from Claude and store together.

        Returns all data in one document:
        - tuition_fees
        - deadline_spring, deadline_summer, deadline_fall
        - english_requirements
        - gpa_requirement
        - test_requirements (GRE/GMAT)
        - scholarships
        - program_duration
        """
        # First check if we already have complete data
        cached = self.db.find_program_all_data(university, degree, field)
        required_fields = ['tuition_fees', 'deadline_spring', 'deadline_summer', 'deadline_fall', 'english_requirements',
                          'gpa_requirement', 'test_requirements', 'scholarships', 'program_duration']

        # Check if all 7 fields exist
        if cached and all(f in cached for f in required_fields):
            return {
                "source": "cache",
                "data": cached,
                "full_response": "All data from database"
            }

        # Not complete in cache - ask Claude for ALL data at once
        prompt = self._build_all_data_prompt(university, degree, field)

        response = self._send_to_claude(prompt)

        if not response["success"]:
            return {
                "source": "error",
                "data": None,
                "full_response": response.get("error", "Unknown error")
            }

        # Parse the response to extract all 7 fields (short data for storage)
        extracted_data = self._parse_all_data(response["text"])

        # Get descriptive part for display
        descriptive_response = self._get_descriptive_part(response["text"])

        # Use official university name if Claude found it
        official_name = extracted_data.pop("official_name", None)
        store_university = official_name if official_name else university
        
        # Store each field in database (all go to same document)
        for field_name, value in extracted_data.items():
            if value:  # Only store if value exists
                self.db.store_data(store_university, degree, field, field_name, value)

        return {
            "source": "claude",
            "data": extracted_data,
            "official_name": store_university,  # Corrected university name
            "descriptive": descriptive_response,  # Easy-to-read explanation
            "full_response": response["text"]
        }

    def _build_all_data_prompt(self, university, degree, field):
        """Build prompt to get descriptive answer + short key data"""
        prompt = f"""Search for {university} {degree} program in {field}.

Give me this information:

1. Tuition fees (per year/semester)
2. Application deadlines (Spring, Summer, Fall semesters)
3. English requirement (IELTS/TOEFL scores)
4. Minimum GPA/CGPA required
5. GRE/GMAT requirement (if any)
6. Scholarships available
7. Program duration

After your explanation, list the KEY DATA in this format:

[KEY_DATA]
UNIVERSITY_NAME: official full name of university
TUITION: amount
DEADLINE_SPRING: date or N/A
DEADLINE_SUMMER: date or N/A
DEADLINE_FALL: date or N/A
ENGLISH: scores
GPA: requirement
GRE_GMAT: requirement or Not required
SCHOLARSHIP: brief info
DURATION: length
[/KEY_DATA]

Use "N/A" if information not found. Now search and provide the information:"""
        return prompt

    def _parse_all_data(self, response_text):
        """Parse Claude's response to extract all 7 fields from KEY_DATA section"""
        data = {
            "official_name": None,
            "tuition_fees": None,
            "deadline_spring": None,
            "deadline_summer": None,
            "deadline_fall": None,
            "english_requirements": None,
            "gpa_requirement": None,
            "test_requirements": None,
            "scholarships": None,
            "program_duration": None
        }

        # Map response labels to our field names
        label_map = {
            "UNIVERSITY_NAME": "official_name",
            "TUITION": "tuition_fees",
            "DEADLINE_SPRING": "deadline_spring",
            "DEADLINE_SUMMER": "deadline_summer",
            "DEADLINE_FALL": "deadline_fall",
            "ENGLISH": "english_requirements",
            "GPA": "gpa_requirement",
            "GRE_GMAT": "test_requirements",
            "GRE": "test_requirements",
            "GMAT": "test_requirements",
            "SCHOLARSHIP": "scholarships",
            "DURATION": "program_duration"
        }

        # Try to extract KEY_DATA section
        key_data_section = response_text
        if "[KEY_DATA]" in response_text:
            start = response_text.find("[KEY_DATA]")
            end = response_text.find("[/KEY_DATA]")
            if end > start:
                key_data_section = response_text[start:end]

        lines = key_data_section.strip().split('\n')

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check each label
            for label, field_name in label_map.items():
                if line.upper().startswith(label):
                    # Extract value after the colon
                    parts = line.split(':', 1)
                    if len(parts) > 1:
                        value = parts[1].strip()
                        # Clean up markdown and brackets
                        value = re.sub(r'\*\*|\*|__|_|\[|\]', '', value)
                        # Skip if N/A or empty
                        if value and value.upper() not in ['N/A', 'NA', 'NOT AVAILABLE', 'NONE', '-', '']:
                            data[field_name] = value
                    break

        return data

    def _get_descriptive_part(self, response_text):
        """Extract the descriptive explanation part (before KEY_DATA)"""
        if "[KEY_DATA]" in response_text:
            return response_text.split("[KEY_DATA]")[0].strip()
        return response_text


    def force_fetch_all_data(self, university, degree, field):
        """
        Force fetch ALL data from AI, ignoring cache.
        Used to update old data with fresh information.
        """
        # Skip cache check - go directly to Claude
        prompt = self._build_all_data_prompt(university, degree, field)

        response = self._send_to_claude(prompt)

        if not response["success"]:
            return {
                "source": "error",
                "data": None,
                "full_response": response.get("error", "Unknown error")
            }

        # Parse the response to extract all fields
        extracted_data = self._parse_all_data(response["text"])

        # Get descriptive part for display
        descriptive_response = self._get_descriptive_part(response["text"])

        # Use official university name if Claude found it
        official_name = extracted_data.pop("official_name", None)
        store_university = official_name if official_name else university
        
        # Store each field in database (replaces old data)
        for field_name, value in extracted_data.items():
            if value:  # Only store if value exists
                self.db.store_data(store_university, degree, field, field_name, value)

        return {
            "source": "claude",
            "data": extracted_data,
            "official_name": store_university,  # Corrected university name
            "descriptive": descriptive_response,
            "full_response": response["text"]
        }

    def close(self):
        """Close database connection"""
        self.db.close()


# Example usage
if __name__ == "__main__":
    extractor = DataExtractor()

    # Test extraction
    result = extractor.search_and_store(
        university="MIT",
        degree="Master",
        field="Computer Science",
        question="What are the tuition fees?"
    )

    print(f"Source: {result['source']}")
    print(f"Query Type: {result['query_type']}")
    print(f"Key Data: {result['key_data']}")
    print(f"Full Response: {result['full_response'][:200]}...")

    extractor.close()
