const SERVER_URL = 'http://localhost:3001';

export interface ChatResponse {
  reply: string;
  sessionId: string;
  sources: string[];
}

export async function sendMessage(message: string, sessionId: string): Promise<ChatResponse> {
  const response = await fetch(`${SERVER_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `Server error ${response.status}`);
  }

  return response.json();
}

export async function clearSession(sessionId: string): Promise<void> {
  await fetch(`${SERVER_URL}/chat/${sessionId}`, { method: 'DELETE' });
}
