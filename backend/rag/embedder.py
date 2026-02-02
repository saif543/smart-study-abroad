"""
Embedder Module - Converts text to numerical vectors

WHAT THIS DOES:
---------------
Takes text like "computer science in Canada" and converts it to
a list of 384 numbers that represent its meaning.

WHY WE NEED THIS:
-----------------
Computers can't understand words, but they CAN compare numbers.
By converting text to numbers, we can find similar meanings.

HOW IT WORKS:
-------------
1. Load a pre-trained model (downloads once, ~90MB)
2. Feed text into the model
3. Get back 384 numbers representing the meaning
4. Use these numbers to find similar universities
"""

from sentence_transformers import SentenceTransformer
from typing import List, Union
import numpy as np
import re


def parse_number(value, default=0):
    """Parse a number from various string formats."""
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # Remove common suffixes and characters
        cleaned = re.sub(r'[/$,+]', '', value)  # Remove $, /, commas, +
        cleaned = re.sub(r'(per\s*)?year.*', '', cleaned, flags=re.IGNORECASE)  # Remove /year, per year, etc.
        cleaned = re.sub(r'[a-zA-Z].*', '', cleaned)  # Remove any trailing text
        cleaned = cleaned.strip()
        if cleaned:
            try:
                return float(cleaned)
            except ValueError:
                return default
    return default


def parse_english_requirements(value):
    """Parse English requirements from string like 'TOEFL 100 / IELTS 7.0'."""
    result = {'TOEFL': 0, 'IELTS': 0}
    if not value:
        return result

    if isinstance(value, dict):
        result['TOEFL'] = parse_number(value.get('TOEFL', 0))
        result['IELTS'] = parse_number(value.get('IELTS', 0))
    elif isinstance(value, str):
        # Parse "TOEFL 100 / IELTS 7.0" format
        import re
        toefl_match = re.search(r'TOEFL\s*(\d+)', value, re.IGNORECASE)
        ielts_match = re.search(r'IELTS\s*([\d.]+)', value, re.IGNORECASE)
        if toefl_match:
            result['TOEFL'] = float(toefl_match.group(1))
        if ielts_match:
            result['IELTS'] = float(ielts_match.group(1))

    return result


class Embedder:
    """
    Converts text to vector embeddings using SentenceTransformers.

    Example:
        embedder = Embedder()
        vector = embedder.embed("computer science masters in canada")
        # Returns: array of 384 numbers
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the embedder with a model.

        Args:
            model_name: The sentence-transformer model to use
                       Default: "all-MiniLM-L6-v2" (small, fast, FREE)

        MODEL DETAILS:
        - Size: ~90MB (downloads once, then cached)
        - Speed: Very fast (can embed 1000 sentences per second)
        - Quality: Good for semantic search
        - Dimensions: 384 (each text becomes 384 numbers)
        """
        print(f"Loading embedding model: {model_name}...")
        print("(First time may take a minute to download)")

        # Load the model - this is the "brain" that understands text
        self.model = SentenceTransformer(model_name)

        # Get the dimension of vectors this model produces
        self.dimension = self.model.get_sentence_embedding_dimension()

        print(f"Model loaded! Produces {self.dimension}-dimensional vectors")

    def embed(self, text: Union[str, List[str]]) -> np.ndarray:
        """
        Convert text to vector embedding(s).

        Args:
            text: A single string or list of strings to embed

        Returns:
            numpy array of shape (384,) for single text
            or shape (N, 384) for list of N texts

        Example:
            # Single text
            vector = embedder.embed("computer science")
            print(vector.shape)  # (384,)

            # Multiple texts
            vectors = embedder.embed(["computer science", "data science"])
            print(vectors.shape)  # (2, 384)
        """
        # The model does all the magic - converts text to numbers
        embeddings = self.model.encode(text, convert_to_numpy=True)
        return embeddings

    def embed_university(self, university_data: dict) -> np.ndarray:
        """
        Create an embedding for a university by combining its key fields.

        This creates a "signature" for each university that captures:
        - What programs they offer
        - Where they're located
        - Cost level
        - Requirements
        - Scholarships

        Args:
            university_data: Dictionary with university information

        Returns:
            384-dimensional vector representing this university
        """
        # Combine important fields into one descriptive text
        # This text captures what makes this university unique

        text_parts = []

        # University name and location
        if university_data.get('university'):
            text_parts.append(university_data['university'])
        if university_data.get('country'):
            text_parts.append(f"in {university_data['country']}")
            # Add country-specific keywords for better matching
            country = university_data['country'].lower()
            if 'usa' in country or 'united states' in country:
                text_parts.append("american university US")
            elif 'canada' in country:
                text_parts.append("canadian university")
            elif 'uk' in country or 'united kingdom' in country:
                text_parts.append("british university UK")
            elif 'germany' in country:
                text_parts.append("german university europe")
            elif 'australia' in country:
                text_parts.append("australian university")

        # Program details - add multiple variations for better matching
        if university_data.get('degree'):
            degree = university_data['degree']
            text_parts.append(degree)
            if 'master' in degree.lower():
                text_parts.append("masters graduate program MS MSc")
            elif 'phd' in degree.lower() or 'doctor' in degree.lower():
                text_parts.append("doctoral research PhD")
            elif 'bachelor' in degree.lower():
                text_parts.append("undergraduate BS BSc")

        if university_data.get('field'):
            field = university_data['field']
            text_parts.append(field)
            # Add related keywords for common fields
            field_lower = field.lower()
            if 'computer' in field_lower or 'cs' in field_lower:
                text_parts.append("software engineering programming technology IT")
            elif 'business' in field_lower or 'mba' in field_lower:
                text_parts.append("management finance marketing administration")
            elif 'data' in field_lower:
                text_parts.append("analytics machine learning AI statistics")
            elif 'engineer' in field_lower:
                text_parts.append("technical STEM technology")

        # Cost indicator (helps match budget)
        tuition = parse_number(university_data.get('tuition_fees', 0))
        if tuition:
            if tuition < 15000:
                text_parts.append("affordable low cost budget friendly cheap")
            elif tuition < 30000:
                text_parts.append("moderate cost mid-range")
            elif tuition < 50000:
                text_parts.append("expensive high cost premium")
            else:
                text_parts.append("very expensive elite premium")

        # Requirements indicator
        gpa = parse_number(university_data.get('gpa_requirement', 0))
        if gpa:
            if gpa >= 3.7:
                text_parts.append("highly competitive selective elite top-tier")
            elif gpa >= 3.5:
                text_parts.append("competitive selective good requirements")
            elif gpa >= 3.0:
                text_parts.append("moderate requirements accessible")
            else:
                text_parts.append("accessible easy requirements")

        # Scholarships
        scholarships = university_data.get('scholarships', '')
        if scholarships and 'yes' in str(scholarships).lower():
            text_parts.append("scholarships available financial aid funding")
        elif scholarships and 'limit' in str(scholarships).lower():
            text_parts.append("limited scholarships")

        # Combine all parts into one text
        combined_text = " ".join(text_parts)

        # Convert to vector
        return self.embed(combined_text)

    def embed_user_query(self, preferences: dict) -> np.ndarray:
        """
        Create an embedding from user's search preferences.

        This converts user's "Find For Me" form data into a vector
        that can be compared with university vectors.

        Args:
            preferences: Dictionary with user preferences like:
                - field: "Computer Science"
                - degree: "Masters"
                - country: "Canada"
                - budget: 30000
                - gpa: 3.5

        Returns:
            384-dimensional vector representing user's ideal university
        """
        text_parts = []

        # What they want to study
        if preferences.get('field'):
            text_parts.append(preferences['field'])
        if preferences.get('degree'):
            text_parts.append(preferences['degree'])

        # Where they want to go
        if preferences.get('country'):
            text_parts.append(f"in {preferences['country']}")

        # Budget level
        budget = preferences.get('budget', 0)
        if budget:
            if budget < 15000:
                text_parts.append("affordable low cost")
            elif budget < 30000:
                text_parts.append("moderate cost")
            else:
                text_parts.append("any cost premium")

        # Their GPA level
        gpa = preferences.get('gpa', 0)
        if gpa:
            if gpa >= 3.5:
                text_parts.append("competitive high requirements")
            elif gpa >= 3.0:
                text_parts.append("moderate requirements")
            else:
                text_parts.append("accessible requirements")

        combined_text = " ".join(text_parts)
        return self.embed(combined_text)


# Quick test when running this file directly
if __name__ == "__main__":
    print("Testing Embedder...")

    embedder = Embedder()

    # Test basic embedding
    test_text = "computer science masters in canada"
    vector = embedder.embed(test_text)
    print(f"\nText: '{test_text}'")
    print(f"Vector shape: {vector.shape}")
    print(f"First 5 numbers: {vector[:5]}")

    # Test similarity
    texts = [
        "computer science masters in canada",
        "CS graduate program in toronto",
        "cooking classes in france"
    ]
    vectors = embedder.embed(texts)

    # Calculate similarity (cosine similarity)
    from numpy import dot
    from numpy.linalg import norm

    def cosine_sim(a, b):
        return dot(a, b) / (norm(a) * norm(b))

    print(f"\nSimilarity between '{texts[0]}' and '{texts[1]}': {cosine_sim(vectors[0], vectors[1]):.3f}")
    print(f"Similarity between '{texts[0]}' and '{texts[2]}': {cosine_sim(vectors[0], vectors[2]):.3f}")
    print("\n(Higher = more similar, 1.0 = identical)")
