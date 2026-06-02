import type { Request, Response } from 'express';
import { Role } from '../../shared/enums.js';
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
  session.messages.push({ role: Role.User, content: message });

  try {
    const { reply, sources, toolsUsed, supervisors, userContext, isClarification, compactedHistory } = await runPipeline(
      session.messages,
      message,
      session.userContext,
      session.toolCache,
    );

    // If compaction ran, replace history with the compact summary
    if (compactedHistory) {
      session.messages = compactedHistory;
    } else {
      session.messages.push({ role: Role.Assistant, content: reply });
    }

    session.userContext = userContext;
    sessionStore.set(sessionId, session);

    res.json({ reply, sessionId, sources, toolsUsed, supervisors, userContext, isClarification });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Request failed';
    res.status(500).json({ error: msg });
  }
}

export function handleClearSession(req: Request, res: Response): void {
  sessionStore.delete(req.params.sessionId);
  res.json({ cleared: true });
}
