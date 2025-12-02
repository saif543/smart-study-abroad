import { NextResponse } from 'next/server';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5000';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { university, degree, field, question, fetchAll, forceRefresh } = body;

    // Call Python backend
    const endpoint = fetchAll ? '/api/fetch_all' : '/api/search';
    const response = await fetch(`${PYTHON_API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        university,
        degree,
        field,
        question,
        force_refresh: forceRefresh || false,
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { source: 'error', error: 'Failed to connect to backend. Make sure Python API is running.' },
      { status: 500 }
    );
  }
}
