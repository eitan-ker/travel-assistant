import type { Request, Response } from 'express';
import { sessionStore } from '../session/store.js';
import { runPipeline } from '../pipeline/index.js';
import type { ChatRequest } from './types.js';

export async function handleChat(req: Request, res: Response): Promise<void> {
  const { message, sessionId } = req.body as ChatRequest;

  if (!message || !sessionId) {
    res.status(400).json({ error: 'message and sessionId are required' });
    return;
  }

  const session = sessionStore.get(sessionId);
  session.messages.push({ role: 'user', content: message });

  try {
    const { reply, sources, toolsUsed, supervisors, userContext } = await runPipeline(
      session.messages,
      message,
      session.userContext,
    );

    session.messages.push({ role: 'assistant', content: reply });
    session.userContext = userContext;
    sessionStore.set(sessionId, session);

    res.json({ reply, sessionId, sources, toolsUsed, supervisors, userContext });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Request failed';
    res.status(500).json({ error: msg });
  }
}

export function handleClearSession(req: Request, res: Response): void {
  sessionStore.delete(req.params.sessionId);
  res.json({ cleared: true });
}
