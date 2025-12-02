"""
MongoDB Handler for Smart Study Abroad
Stores all data in ONE document per university+degree+field
"""

from pymongo import MongoClient
from datetime import datetime


def normalize_university_name(name):
    """Normalize university name for consistent matching"""
    name = name.lower().strip()
    # Remove common suffixes
    suffixes = [' university', ' college', ' institute', ' school']
    for suffix in suffixes:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()
    return name


class MongoDBHandler:
    """Handler for MongoDB - ONE document per program"""

    def __init__(self, connection_string="mongodb://localhost:27017/", db_name="smart_study_abroad"):
        self.client = MongoClient(connection_string)
        self.db = self.client[db_name]
        self.collection = self.db["university_data"]

    def store_data(self, university, degree, field, query_type, data):
        """
        Store data in single document per university+degree+field

        Structure:
        {
            "university": "mit",
            "degree": "bachelor",
            "field": "computer science",
            "tuition_fees": "$61,990/year",
            "english_requirements": "TOEFL 90",
            "application_deadline": "Jan 1",
            ...
        }
        """
        # Don't store if no data
        if not data or data.strip() == "":
            return None

        uni_key = normalize_university_name(university)
        deg_key = degree.lower().strip()
        field_key = field.lower().strip()
        qtype_key = query_type.lower().strip()

        # Find existing document for this program
        existing = self.collection.find_one({
            "university": uni_key,
            "degree": deg_key,
            "field": field_key
        })

        current_year = datetime.now().year

        if existing:
            # Update existing document - add new field
            self.collection.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        qtype_key: data,
                        "data_year": current_year,
                        "updated_at": datetime.now()
                    }
                }
            )
            return "updated"
        else:
            # Create new document
            document = {
                "university": uni_key,
                "degree": deg_key,
                "field": field_key,
                qtype_key: data,
                "created_at": datetime.now(),
                "data_year": current_year,
                "updated_at": datetime.now()
            }
            result = self.collection.insert_one(document)
            return result.inserted_id

    def find_data(self, university, degree, field, query_type):
        """Find specific data from program document"""
        uni_key = normalize_university_name(university)
        deg_key = degree.lower().strip()
        field_key = field.lower().strip()
        qtype_key = query_type.lower().strip()

        result = self.collection.find_one({
            "university": uni_key,
            "degree": deg_key,
            "field": field_key
        })

        if result and qtype_key in result:
            return {
                "found": True,
                "data": result[qtype_key],
                "updated_at": result.get("updated_at"),
                "data_year": result.get("data_year")
            }
        return {"found": False, "data": None}

    def find_program_all_data(self, university, degree, field):
        """Get ALL stored data for a specific program including data_year"""
        result = self.collection.find_one({
            "university": normalize_university_name(university),
            "degree": degree.lower().strip(),
            "field": field.lower().strip()
        })

        if result:
            # Remove internal fields, return only data (but keep data_year)
            data = {}
            skip_fields = ["_id", "university", "degree", "field", "created_at", "updated_at"]
            for key, value in result.items():
                if key not in skip_fields:
                    data[key] = value
            return data
        return {}

    def get_all_programs(self):
        """Get list of all programs in database"""
        results = self.collection.find({}, {"university": 1, "degree": 1, "field": 1})
        programs = []
        for doc in results:
            programs.append({
                "university": doc["university"],
                "degree": doc["degree"],
                "field": doc["field"]
            })
        return programs

    def get_all_universities(self):
        """Get unique university names"""
        return self.collection.distinct("university")

    def delete_program(self, university, degree, field):
        """Delete entire program document"""
        result = self.collection.delete_one({
            "university": normalize_university_name(university),
            "degree": degree.lower().strip(),
            "field": field.lower().strip()
        })
        return result.deleted_count > 0

    def close(self):
        """Close MongoDB connection"""
        self.client.close()


# Quick test
if __name__ == "__main__":
    db = MongoDBHandler()

    # Test: Store multiple data points for same program
    db.store_data("MIT", "Master", "Computer Science", "tuition_fees", "$61,990 per year")
    db.store_data("MIT", "Master", "Computer Science", "english_requirements", "TOEFL 100+")
    db.store_data("MIT", "Master", "Computer Science", "gpa_requirement", "3.5+")

    # Should be ONE document with all 3 fields
    all_data = db.find_program_all_data("MIT", "Master", "Computer Science")
    print(f"MIT Master CS data: {all_data}")

    # Different program = different document
    db.store_data("MIT", "Bachelor", "Computer Science", "tuition_fees", "$59,750 per year")

    print(f"All programs: {db.get_all_programs()}")

    db.close()
