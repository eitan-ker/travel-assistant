const SERVER_URL = 'http://localhost:3001';

export interface SupervisorLog {
  name: string;
  verdict: 'PASS' | 'REFINED' | 'SKIPPED' | 'CLARIFY' | 'REFINE';
}

export interface UserContext {
  destination?: string;
  origin?: string;
  passport?: string[];
  interests?: string[];
  budget?: string;
  travelStyle?: string;
  tripDuration?: string;
  travelGroup?: string;
  travelerConstraints?: string;
  notes?: string;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  sources: string[];
  toolsUsed: string[];
  supervisors: SupervisorLog[];
  userContext?: UserContext;
  isClarification?: boolean;
}

export async function sendMessage(message: string, sessionId: string): Promise<ChatResponse> {
  const response = await fetch(`${SERVER_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!response.ok) {
    const err = await response.json().catch((e: unknown) => {
      console.error('[api] failed to parse error response', e);
      return { error: `Server error ${response.status}` };
    });
    throw new Error(err.error ?? `Server error ${response.status}`);
  }

  return response.json();
}

export async function clearSession(sessionId: string): Promise<void> {
  await fetch(`${SERVER_URL}/chat/${sessionId}`, { method: 'DELETE' });
}
