export interface ChatRequest {
  message: string;
  sessionId: string;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  sources: string[];
  toolsUsed: string[];
  supervisors: { name: string; verdict: string }[];
  userContext: Record<string, unknown>;
}
