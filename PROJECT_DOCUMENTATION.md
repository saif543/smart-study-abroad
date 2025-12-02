# SmartStudy Abroad - Complete Project Documentation

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Streamlit vs Next.js](#3-streamlit-vs-nextjs)
4. [File Structure](#4-file-structure)
5. [Data Flow](#5-data-flow)
6. [Backend Code Explanation](#6-backend-code-explanation)
7. [MongoDB Connection](#7-mongodb-connection)
8. [Next.js API Routes](#8-nextjs-api-routes)
9. [Frontend Components](#9-frontend-components)
10. [How to Run](#10-how-to-run)
11. [Comparison Table](#11-comparison-table)

---

## 1. Project Overview

SmartStudy Abroad is a web application that helps students find information about universities for studying abroad. It uses:
- **AI (Claude)** to fetch university information
- **MongoDB** to cache/store data
- **Next.js** for the frontend (what users see)
- **Flask** for the backend (processes requests)

### What the app does:
1. **Search University** - Search for specific university programs
2. **Find For Me** - AI finds universities based on your requirements
3. **AI Chat** - Ask questions about studying abroad

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         YOUR APPLICATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐         ┌──────────────┐         ┌─────────┐ │
│   │   FRONTEND   │ ──────► │   BACKEND    │ ──────► │ DATABASE│ │
│   │  (Next.js)   │ ◄────── │   (Flask)    │ ◄────── │(MongoDB)│ │
│   │  Port: 3000  │         │  Port: 5000  │         │Port:27017│ │
│   └──────────────┘         └──────────────┘         └─────────┘ │
│         │                        │                              │
│         │                        ▼                              │
│         │                 ┌──────────────┐                      │
│         │                 │  Claude CLI  │                      │
│         │                 │  (AI Queries)│                      │
│         │                 └──────────────┘                      │
│         ▼                                                        │
│   ┌──────────────┐                                              │
│   │    USER      │                                              │
│   │  (Browser)   │                                              │
│   └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

### How they communicate:
- **User** opens browser at `http://localhost:3000`
- **Next.js** serves the website and handles user interactions
- **Next.js API** forwards requests to Flask backend
- **Flask** processes requests, checks MongoDB, calls Claude if needed
- **MongoDB** stores all university data for fast retrieval
- **Claude CLI** fetches fresh data when not in database

---

## 3. Streamlit vs Next.js

### Streamlit (What we had before)

```python
# Everything in ONE Python file - simple but limited
import streamlit as st

st.title("My App")                    # Title
name = st.text_input("Enter name")    # Input box
if st.button("Search"):               # Button
    result = search_database(name)    # Logic
    st.write(result)                  # Show result
```

**Pros:**
- Very simple to write
- Python only
- Quick prototyping

**Cons:**
- Limited design options
- No custom CSS/animations
- Not a "real" website
- Slow for production

### Next.js (What we have now)

```
Frontend (React/Next.js) ──► Backend (Flask/Python) ──► Database (MongoDB)
     │                              │
     │                              │
   Shows UI                    Does the work
   to user                     (search, AI, etc)
```

**Pros:**
- Full design control
- Fast and professional
- Modern animations
- Scales well
- Industry standard

**Cons:**
- More complex
- Need to know TypeScript/React
- Multiple files to manage

---

## 4. File Structure

```
D:/aos_project/499/
│
├── src/                              # FRONTEND (Next.js)
│   │
│   ├── app/                          # App Router (Next.js 14)
│   │   ├── page.tsx                  # Main homepage component
│   │   ├── layout.tsx                # Root layout (wraps all pages)
│   │   ├── globals.css               # Global styles and animations
│   │   │
│   │   └── api/                      # API Routes (middleman to backend)
│   │       ├── search/
│   │       │   └── route.ts          # POST /api/search
│   │       ├── findme/
│   │       │   └── route.ts          # POST /api/findme
│   │       └── chat/
│   │           └── route.ts          # POST /api/chat
│   │
│   └── components/                   # Reusable UI Components
│       ├── Navbar.tsx                # Top navigation bar
│       ├── SearchTab.tsx             # University search form
│       ├── FindForMeTab.tsx          # AI matching form
│       └── AIChat.tsx                # Floating chat widget
│
├── backend/                          # BACKEND (Python/Flask)
│   ├── api_server.py                 # Main Flask server
│   ├── mongodb_handler.py            # Database operations
│   ├── data_extractor.py             # Claude AI integration
│   └── requirements.txt              # Python dependencies
│
├── public/                           # Static files (images, etc.)
│
├── package.json                      # Node.js dependencies
├── tailwind.config.ts                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
└── next.config.mjs                   # Next.js configuration
```

---

## 5. Data Flow

### Example: User Searches for "MIT Computer Science"

```
Step 1: USER ACTION
        └── User types "MIT" and clicks Search button

Step 2: FRONTEND (SearchTab.tsx)
        └── React captures the click event
        └── Calls fetch('/api/search', { university: 'MIT', field: 'CS' })

Step 3: NEXT.JS API ROUTE (src/app/api/search/route.ts)
        └── Receives the request
        └── Forwards to Python: fetch('http://localhost:5000/api/search')

Step 4: FLASK BACKEND (backend/api_server.py)
        └── Receives the request
        └── Extracts: university='MIT', field='CS'

Step 5: DATABASE CHECK (mongodb_handler.py)
        └── Queries: programs.find_one({university: 'MIT', field: 'CS'})

Step 6a: IF DATA EXISTS IN DATABASE
         └── Return cached data immediately (very fast!)
         └── Response: { source: 'cache', data: {...} }

Step 6b: IF DATA NOT IN DATABASE
         └── Call Claude CLI (data_extractor.py)
         └── Claude returns fresh university info
         └── Save to MongoDB for future requests
         └── Response: { source: 'claude', data: {...} }

Step 7: RESPONSE CHAIN
        └── Flask → Next.js API → SearchTab.tsx → User sees result
```

### Visual Flow:
```
┌────────┐    ┌─────────┐    ┌───────────┐    ┌───────┐    ┌─────────┐
│  User  │───►│ Search  │───►│ Next.js   │───►│ Flask │───►│ MongoDB │
│ clicks │    │ Tab.tsx │    │ API Route │    │       │    │         │
└────────┘    └─────────┘    └───────────┘    └───────┘    └─────────┘
                                                   │
                                                   ▼
                                              ┌─────────┐
                                              │ Claude  │
                                              │  (AI)   │
                                              └─────────┘
```

---

## 6. Backend Code Explanation

### File: `backend/api_server.py`

This is the main Flask server that handles all API requests.

```python
# ============================================
# IMPORTS
# ============================================
from flask import Flask, request, jsonify
# Flask = the web framework
# request = to get data from incoming requests
# jsonify = to convert Python dict to JSON response

from flask_cors import CORS
# CORS = Cross-Origin Resource Sharing
# Allows Next.js (port 3000) to talk to Flask (port 5000)

import mongodb_handler
# Our custom module to handle database operations

import data_extractor
# Our custom module to call Claude CLI

# ============================================
# APP SETUP
# ============================================
app = Flask(__name__)
# Create a Flask application instance

CORS(app)
# Enable CORS for all routes
# Without this, browser would block requests from different ports

# ============================================
# ROUTES (ENDPOINTS)
# ============================================

@app.route('/api/search', methods=['POST'])
def search():
    """
    Search for university program information.

    Expected JSON body:
    {
        "university": "MIT",
        "degree": "Master",
        "field": "Computer Science",
        "question": "tuition fees",
        "fetchAll": false
    }
    """

    # Get JSON data from request body
    data = request.json

    # Extract individual fields
    university = data.get('university')      # "MIT"
    degree = data.get('degree', 'Master')    # Default to "Master"
    field = data.get('field')                # "Computer Science"
    fetch_all = data.get('fetchAll', False)  # True or False

    # Step 1: Check if data exists in database (cache)
    cached_data = mongodb_handler.find_program(university, degree, field)

    if cached_data:
        # Data found in database! Return it immediately
        return jsonify({
            'source': 'cache',           # Tell frontend it's from cache
            'data': cached_data,         # The actual data
            'data_year': cached_data.get('data_year'),
            'official_name': cached_data.get('official_name')
        })

    # Step 2: Not in database, ask Claude AI
    if fetch_all:
        # Get all 7 data points
        fresh_data = data_extractor.extract_all_info(university, degree, field)
    else:
        # Get specific information
        fresh_data = data_extractor.extract_info(university, degree, field, question)

    # Step 3: Save to database for future requests
    mongodb_handler.save_program(fresh_data)

    # Step 4: Return the fresh data
    return jsonify({
        'source': 'claude',           # Tell frontend it's fresh from AI
        'data': fresh_data,
        'official_name': fresh_data.get('official_name')
    })


@app.route('/api/findme', methods=['POST'])
def find_for_me():
    """
    Find universities matching user requirements.

    Expected JSON body:
    {
        "degree": "Master",
        "field": "Computer Science",
        "maxTuition": "50000",
        "minGPA": "3.5",
        "country": "USA",
        "preferScholarship": true
    }
    """

    data = request.json

    # Build requirements object
    requirements = {
        'degree': data.get('degree'),
        'field': data.get('field'),
        'max_tuition': data.get('maxTuition'),
        'gpa': data.get('minGPA'),
        'english_test': data.get('englishTest'),
        'english_score': data.get('englishScore'),
        'country': data.get('country'),
        'scholarship': data.get('preferScholarship')
    }

    # Ask Claude to find matching universities
    matches = data_extractor.find_matching_universities(requirements)

    return jsonify({
        'universities': matches
    })


@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Handle AI chat messages.

    Expected JSON body:
    {
        "message": "What are the best universities for CS?"
    }
    """

    data = request.json
    message = data.get('message')

    # Send to Claude and get response
    response = data_extractor.chat_response(message)

    return jsonify({
        'response': response
    })


@app.route('/api/health', methods=['GET'])
def health():
    """
    Health check endpoint.
    Used to verify the server is running.
    """
    return jsonify({'status': 'healthy'})


# ============================================
# RUN SERVER
# ============================================
if __name__ == '__main__':
    # Start the Flask development server
    # host='0.0.0.0' = accept connections from any IP
    # port=5000 = run on port 5000
    # debug=True = show detailed errors, auto-reload on code changes
    app.run(host='0.0.0.0', port=5000, debug=True)
```

---

## 7. MongoDB Connection

### File: `backend/mongodb_handler.py`

This file handles all database operations.

```python
# ============================================
# IMPORTS
# ============================================
from pymongo import MongoClient
# MongoClient = connects to MongoDB database

from datetime import datetime
# For timestamps

import re
# Regular expressions for text matching

# ============================================
# DATABASE CONNECTION
# ============================================

# Connect to MongoDB server running on localhost
client = MongoClient('mongodb://localhost:27017/')

# Select (or create) database named 'smartstudy'
# Think of database as a folder
db = client['smartstudy']

# Select (or create) collection named 'programs'
# Think of collection as a file/table inside the folder
programs = db['programs']

# ============================================
# HELPER FUNCTIONS
# ============================================

def normalize_name(name):
    """
    Normalize university name for consistent matching.

    Example:
        "MIT" → "massachusetts institute of technology"
        "  Harvard  " → "harvard"
    """
    # Dictionary of common abbreviations
    abbreviations = {
        'mit': 'massachusetts institute of technology',
        'ucla': 'university of california los angeles',
        'usc': 'university of southern california',
        # ... more abbreviations
    }

    # Convert to lowercase and strip whitespace
    normalized = name.lower().strip()

    # Replace abbreviation if exists
    if normalized in abbreviations:
        return abbreviations[normalized]

    return normalized

# ============================================
# CRUD OPERATIONS
# ============================================

def save_program(data):
    """
    Save a program to the database.

    Parameters:
        data (dict): Program information
            {
                'university': 'MIT',
                'degree': 'Master',
                'field': 'Computer Science',
                'tuition_fees': '$55,000',
                'deadline_fall': 'December 15',
                ...
            }

    Returns:
        str: ID of inserted document
    """

    # Add metadata
    data['created_at'] = datetime.now()
    data['updated_at'] = datetime.now()
    data['normalized_name'] = normalize_name(data.get('university', ''))

    # Insert into collection
    result = programs.insert_one(data)

    # Return the generated ID
    return str(result.inserted_id)


def find_program(university, degree, field):
    """
    Find a program in the database.

    Parameters:
        university (str): University name (e.g., "MIT")
        degree (str): Degree level (e.g., "Master")
        field (str): Field of study (e.g., "Computer Science")

    Returns:
        dict or None: Program data if found, None otherwise
    """

    # Normalize the university name for matching
    normalized = normalize_name(university)

    # Try exact match first
    result = programs.find_one({
        'normalized_name': normalized,
        'degree': degree,
        'field': {'$regex': field, '$options': 'i'}  # Case-insensitive
    })

    if result:
        # Remove MongoDB's internal _id field (not JSON serializable)
        result.pop('_id', None)
        return result

    # Try fuzzy match
    result = programs.find_one({
        'normalized_name': {'$regex': normalized, '$options': 'i'},
        'degree': degree,
        'field': {'$regex': field, '$options': 'i'}
    })

    if result:
        result.pop('_id', None)
        return result

    return None


def update_program(university, degree, field, new_data):
    """
    Update an existing program.

    Parameters:
        university (str): University name
        degree (str): Degree level
        field (str): Field of study
        new_data (dict): New data to update

    Returns:
        bool: True if updated, False if not found
    """

    normalized = normalize_name(university)

    # Add update timestamp
    new_data['updated_at'] = datetime.now()

    result = programs.update_one(
        {
            'normalized_name': normalized,
            'degree': degree,
            'field': {'$regex': field, '$options': 'i'}
        },
        {'$set': new_data}  # $set = update these fields
    )

    return result.modified_count > 0


def delete_program(university, degree, field):
    """
    Delete a program from database.

    Returns:
        bool: True if deleted, False if not found
    """

    normalized = normalize_name(university)

    result = programs.delete_one({
        'normalized_name': normalized,
        'degree': degree,
        'field': {'$regex': field, '$options': 'i'}
    })

    return result.deleted_count > 0


def get_all_programs():
    """
    Get all programs in the database.

    Returns:
        list: List of all program documents
    """

    results = list(programs.find())

    # Remove _id from each document
    for doc in results:
        doc.pop('_id', None)

    return results


def search_programs(query):
    """
    Search programs by any field.

    Parameters:
        query (str): Search term

    Returns:
        list: Matching programs
    """

    results = list(programs.find({
        '$or': [
            {'university': {'$regex': query, '$options': 'i'}},
            {'field': {'$regex': query, '$options': 'i'}},
            {'official_name': {'$regex': query, '$options': 'i'}}
        ]
    }))

    for doc in results:
        doc.pop('_id', None)

    return results
```

### MongoDB Concepts Explained:

```
┌─────────────────────────────────────────────────────────────┐
│                     MongoDB Server                           │
│                   (localhost:27017)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Database: smartstudy                      │  │
│  │              (like a folder)                           │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │         Collection: programs                     │  │  │
│  │  │         (like a table/file)                      │  │  │
│  │  ├─────────────────────────────────────────────────┤  │  │
│  │  │                                                  │  │  │
│  │  │  Document 1: {                                   │  │  │
│  │  │    "_id": "abc123",                              │  │  │
│  │  │    "university": "MIT",                          │  │  │
│  │  │    "degree": "Master",                           │  │  │
│  │  │    "field": "Computer Science",                  │  │  │
│  │  │    "tuition_fees": "$55,000/year",               │  │  │
│  │  │    "deadline_fall": "December 15",               │  │  │
│  │  │    "gpa_requirement": "3.5+",                    │  │  │
│  │  │    "data_year": 2024                             │  │  │
│  │  │  }                                               │  │  │
│  │  │                                                  │  │  │
│  │  │  Document 2: {                                   │  │  │
│  │  │    "_id": "def456",                              │  │  │
│  │  │    "university": "Harvard",                      │  │  │
│  │  │    "degree": "Master",                           │  │  │
│  │  │    "field": "MBA",                               │  │  │
│  │  │    "tuition_fees": "$73,000/year",               │  │  │
│  │  │    ...                                           │  │  │
│  │  │  }                                               │  │  │
│  │  │                                                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Next.js API Routes

### Why We Need API Routes (Middleman)

```
Problem:
Browser ──✗──► Python Backend
          │
          └── CORS Error! Browser blocks cross-origin requests

Solution:
Browser ──✓──► Next.js API ──✓──► Python Backend
          │         │
          │         └── Same origin (localhost:3000)
          │
          └── Works! Next.js handles CORS properly
```

### File: `src/app/api/search/route.ts`

```typescript
// ============================================
// SEARCH API ROUTE
// ============================================

// This file handles POST requests to /api/search
// It acts as a middleman between frontend and Python backend

export async function POST(request: Request) {
  // ============================================
  // STEP 1: Get data from frontend
  // ============================================

  // request.json() parses the JSON body sent by frontend
  const body = await request.json();

  // body = {
  //   university: "MIT",
  //   degree: "Master",
  //   field: "Computer Science",
  //   fetchAll: true
  // }

  // ============================================
  // STEP 2: Forward request to Python backend
  // ============================================

  try {
    const response = await fetch('http://localhost:5000/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),  // Forward the same data
    });

    // ============================================
    // STEP 3: Get response from Python
    // ============================================

    const data = await response.json();

    // data = {
    //   source: "cache",
    //   data: { tuition: "$55,000", ... },
    //   official_name: "Massachusetts Institute of Technology"
    // }

    // ============================================
    // STEP 4: Send response back to frontend
    // ============================================

    return Response.json(data);

  } catch (error) {
    // If Python backend is down or error occurs
    return Response.json(
      { error: 'Backend server is not available' },
      { status: 500 }
    );
  }
}
```

### File: `src/app/api/findme/route.ts`

```typescript
// ============================================
// FIND FOR ME API ROUTE
// ============================================

export async function POST(request: Request) {
  const body = await request.json();

  // body = {
  //   degree: "Master",
  //   field: "Computer Science",
  //   maxTuition: "50000",
  //   minGPA: "3.5",
  //   country: "USA",
  //   preferScholarship: true
  // }

  try {
    const response = await fetch('http://localhost:5000/api/findme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // data = {
    //   universities: [
    //     { name: "MIT", match_score: 95, tuition: "$55,000", ... },
    //     { name: "Stanford", match_score: 90, tuition: "$57,000", ... }
    //   ]
    // }

    return Response.json(data);

  } catch (error) {
    return Response.json(
      { error: 'Backend server is not available' },
      { status: 500 }
    );
  }
}
```

### File: `src/app/api/chat/route.ts`

```typescript
// ============================================
// CHAT API ROUTE
// ============================================

export async function POST(request: Request) {
  const body = await request.json();

  // body = {
  //   message: "What are the best universities for CS?"
  // }

  try {
    const response = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // data = {
    //   response: "The best universities for CS include MIT, Stanford, ..."
    // }

    return Response.json(data);

  } catch (error) {
    return Response.json(
      { response: 'Sorry, the AI service is temporarily unavailable.' },
      { status: 500 }
    );
  }
}
```

---

## 9. Frontend Components

### File: `src/app/page.tsx` (Main Page)

```tsx
// ============================================
// MAIN PAGE COMPONENT
// ============================================

'use client';  // This is a Client Component (runs in browser)

import { useState } from 'react';
// useState = React hook to manage component state

import Navbar from '@/components/Navbar';
import SearchTab from '@/components/SearchTab';
import FindForMeTab from '@/components/FindForMeTab';
import AIChat from '@/components/AIChat';

export default function Home() {
  // ============================================
  // STATE MANAGEMENT
  // ============================================

  // currentTool tracks which tab is active: 'search' or 'findme'
  const [currentTool, setCurrentTool] = useState<'search' | 'findme'>('search');

  // aiMessages stores messages to show in AI chat
  const [aiMessages, setAiMessages] = useState<string[]>([]);

  // ============================================
  // EVENT HANDLERS
  // ============================================

  // Called when user switches tabs
  const handleToolChange = (tool: 'search' | 'findme') => {
    setCurrentTool(tool);
  };

  // Called when search/findme components want to show a message
  const handleAIMessage = (message: string) => {
    setAiMessages(prev => [...prev, message]);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-300 opacity-30 blob float" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-pink-300 opacity-30 blob float-delayed" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-cyan-300 opacity-30 blob float" />
      </div>

      {/* Navigation bar */}
      <Navbar currentTool={currentTool} onToolChange={handleToolChange} />

      {/* Hero Section */}
      <section className="gradient-bg pt-32 pb-20 px-4 relative overflow-hidden">
        {/* Content here... */}
      </section>

      {/* Main Content */}
      <section className="max-w-4xl mx-auto px-4 py-12 -mt-10 relative z-10">
        {/* Show SearchTab or FindForMeTab based on currentTool */}
        {currentTool === 'search' ? (
          <SearchTab onAIMessage={handleAIMessage} />
        ) : (
          <FindForMeTab onAIMessage={handleAIMessage} />
        )}
      </section>

      {/* AI Chat Widget */}
      <AIChat systemMessages={aiMessages} />
    </main>
  );
}
```

### File: `src/components/SearchTab.tsx`

```tsx
// ============================================
// SEARCH TAB COMPONENT
// ============================================

'use client';

import { useState } from 'react';

// ============================================
// TYPE DEFINITIONS (TypeScript)
// ============================================

interface SearchResult {
  source: 'cache' | 'claude' | 'error';
  data?: Record<string, string>;
  descriptive?: string;
  data_year?: number;
  official_name?: string;
}

interface SearchTabProps {
  onAIMessage: (message: string) => void;  // Function to send messages to chat
}

// ============================================
// COMPONENT
// ============================================

export default function SearchTab({ onAIMessage }: SearchTabProps) {
  // ============================================
  // STATE
  // ============================================

  const [university, setUniversity] = useState('');        // Input value
  const [degree, setDegree] = useState<'Bachelor' | 'Master' | 'PhD'>('Master');
  const [field, setField] = useState('');
  const [question, setQuestion] = useState('');
  const [fetchAll, setFetchAll] = useState(false);         // Checkbox state
  const [loading, setLoading] = useState(false);           // Loading spinner
  const [result, setResult] = useState<SearchResult | null>(null);  // API response

  // ============================================
  // SEARCH FUNCTION
  // ============================================

  const handleSearch = async () => {
    // Validation
    if (!university || !field) {
      onAIMessage('Please enter university name and field of study');
      return;
    }

    // Start loading
    setLoading(true);
    onAIMessage(`Searching for ${university} - ${degree} in ${field}...`);

    try {
      // ============================================
      // API CALL
      // ============================================

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university,
          degree,
          field,
          question: fetchAll ? 'all' : question,
          fetchAll,
        }),
      });

      // Parse JSON response
      const data = await response.json();

      // Save result to state
      setResult(data);

      // Show appropriate message
      if (data.source === 'cache') {
        onAIMessage(`Found data from database (${data.data_year || 'N/A'})`);
      } else if (data.source === 'claude') {
        onAIMessage('Fresh data fetched from AI and stored in database');
      }

    } catch (error) {
      onAIMessage(`Error: ${error}`);
      setResult({ source: 'error' });
    } finally {
      setLoading(false);  // Stop loading spinner
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-8 slide-up">
      {/* Search Form */}
      <div className="bg-white rounded-3xl shadow-xl p-8">

        {/* University Input */}
        <input
          type="text"
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
          placeholder="e.g., MIT, Harvard"
          className="w-full px-5 py-4 rounded-2xl border-2"
        />

        {/* Degree Select */}
        <select
          value={degree}
          onChange={(e) => setDegree(e.target.value as 'Bachelor' | 'Master' | 'PhD')}
        >
          <option value="Bachelor">Bachelor</option>
          <option value="Master">Master</option>
          <option value="PhD">PhD</option>
        </select>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-500"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results */}
      {result && result.source !== 'error' && (
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h3>{result.official_name || university}</h3>
          {/* Display data... */}
        </div>
      )}
    </div>
  );
}
```

### File: `src/components/AIChat.tsx`

```tsx
// ============================================
// AI CHAT COMPONENT
// ============================================

'use client';

import { useState, useRef, useEffect } from 'react';

// ============================================
// TYPES
// ============================================

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface AIChatProps {
  systemMessages: string[];  // Messages from parent components
}

// ============================================
// COMPONENT
// ============================================

export default function AIChat({ systemMessages }: AIChatProps) {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);  // Chat window open/closed

  // Ref for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ============================================
  // EFFECTS
  // ============================================

  // Add system messages from parent components
  useEffect(() => {
    if (systemMessages.length > 0) {
      const lastMessage = systemMessages[systemMessages.length - 1];

      setMessages(prev => {
        // Don't add duplicate messages
        const existingTexts = prev.map(m => m.text);
        if (!existingTexts.includes(lastMessage)) {
          return [...prev, {
            id: Date.now().toString(),
            text: lastMessage,
            sender: 'ai',
            timestamp: new Date(),
          }];
        }
        return prev;
      });
    }
  }, [systemMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============================================
  // SEND MESSAGE
  // ============================================

  const handleSend = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      // Add AI response
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: data.response || 'Sorry, I could not process that.',
        sender: 'ai',
        timestamp: new Date(),
      }]);

    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, there was an error. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Chat Window (when expanded) */}
      {isExpanded && (
        <div className="bg-white rounded-3xl shadow-2xl w-[420px] h-[600px]">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-500 p-5">
            <h3>AI Assistant</h3>
            <button onClick={() => setIsExpanded(false)}>Close</button>
          </div>

          {/* Messages */}
          <div className="overflow-y-auto p-5">
            {messages.map((msg) => (
              <div key={msg.id}>
                <p>{msg.text}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..."
            />
            <button onClick={handleSend}>Send</button>
          </div>
        </div>
      )}

      {/* Toggle Button (when collapsed) */}
      {!isExpanded && (
        <button onClick={() => setIsExpanded(true)}>
          🤖 Chat
        </button>
      )}
    </div>
  );
}
```

---

## 10. How to Run

### Prerequisites:
1. **Node.js** installed (v18 or higher)
2. **Python** installed (v3.8 or higher)
3. **MongoDB** running on localhost:27017
4. **Claude CLI** configured

### Step-by-Step:

```bash
# Terminal 1: Start MongoDB (if not running as service)
mongod

# Terminal 2: Start Python Backend
cd D:/aos_project/499/backend
pip install -r requirements.txt    # Install dependencies (first time only)
python api_server.py               # Start server

# Output: Running on http://localhost:5000

# Terminal 3: Start Next.js Frontend
cd D:/aos_project/499
npm install                        # Install dependencies (first time only)
npm run dev                        # Start development server

# Output: Ready on http://localhost:3000
```

### Verify Everything is Running:

```bash
# Check Python backend
curl http://localhost:5000/api/health
# Should return: {"status": "healthy"}

# Check Next.js
# Open browser to http://localhost:3000
# Should see the SmartStudy website
```

---

## 11. Comparison Table

| Feature | Streamlit | Next.js |
|---------|-----------|---------|
| **Language** | Python only | TypeScript + Python |
| **Design Control** | Limited | Full control (CSS, animations) |
| **Learning Curve** | Easy | Medium |
| **Performance** | Slower | Faster |
| **Scalability** | Limited | Excellent |
| **Professional Look** | Basic | Modern, polished |
| **Database Access** | Direct | Through API |
| **Deployment** | Streamlit Cloud | Any server (Vercel, AWS, etc.) |
| **Code Organization** | Single file | Multiple files (better organized) |
| **Animations** | Very limited | Full CSS/JS animations |
| **Mobile Support** | Automatic | Responsive design |
| **SEO** | None | Full SEO support |

---

## Key Concepts Summary

### 1. Frontend (Next.js)
- **What**: The part users see and interact with
- **Where**: `src/` folder
- **Technology**: React, TypeScript, Tailwind CSS
- **Port**: 3000

### 2. Backend (Flask)
- **What**: The brain that processes requests
- **Where**: `backend/` folder
- **Technology**: Python, Flask
- **Port**: 5000

### 3. Database (MongoDB)
- **What**: Storage for university data
- **Where**: Running on localhost
- **Technology**: MongoDB (NoSQL)
- **Port**: 27017

### 4. API
- **What**: How frontend and backend communicate
- **Format**: JSON over HTTP
- **Methods**: POST (send data), GET (retrieve data)

### 5. The Flow
```
User Action → React Component → fetch() → Next.js API → Flask → MongoDB/Claude → Response back
```

---

## Troubleshooting

### Common Issues:

**1. "Backend server is not available"**
- Make sure Python server is running: `python api_server.py`

**2. "MongoDB connection failed"**
- Make sure MongoDB is running: `mongod`

**3. "Port already in use"**
- Kill existing process: `npx kill-port 3000` or `npx kill-port 5000`

**4. "Module not found"**
- Install dependencies: `npm install` or `pip install -r requirements.txt`

---

## Created By
SmartStudy Abroad Team - 2024/2025

Documentation generated for educational purposes.
