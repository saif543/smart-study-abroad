import { NextResponse } from 'next/server';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5000';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Call Python backend
    const response = await fetch(`${PYTHON_API_URL}/api/findme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('FindMe API error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend. Make sure Python API is running.' },
      { status: 500 }
    );
  }
}
