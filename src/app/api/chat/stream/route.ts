const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5000';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Forward to Flask streaming endpoint
    const response = await fetch(`${PYTHON_API_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.body) {
      return new Response('No response body', { status: 502 });
    }

    // Pass through the SSE stream from Flask to the browser
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat stream error:', error);
    const fallback = `data: ${JSON.stringify({ token: 'Cannot connect to AI backend. Is Ollama running?' })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`;
    return new Response(fallback, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }
}
