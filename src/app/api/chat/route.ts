import { NextResponse } from 'next/server';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5000';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message } = body;

    // Call Python backend
    const response = await fetch(`${PYTHON_API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { response: 'Sorry, I could not connect to the AI backend. Please try again later.' },
      { status: 500 }
    );
  }
}
