import { Router, Request, Response } from 'express';
import { getLLMProvider } from '../llm/factory.js';
import { sessionStore } from '../session/store.js';
import { buildContext } from '../context/builder.js';
import type { Message } from '../llm/provider.js';

export const chatRouter = Router();

chatRouter.post('/', async (req: Request, res: Response) => {
  const { message, sessionId } = req.body as { message: string; sessionId: string };

  if (!message || !sessionId) {
    res.status(400).json({ error: 'message and sessionId are required' });
    return;
  }

  const history = sessionStore.get(sessionId);
  history.push({ role: 'user', content: message });

  try {
    const { messages, sources } = await buildContext(history, message);

    const provider = getLLMProvider();
    const reply = await provider.chat(messages);

    history.push({ role: 'assistant', content: reply });
    sessionStore.set(sessionId, history);

    res.json({ reply, sessionId, sources });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'LLM request failed';
    res.status(500).json({ error: msg });
  }
});

chatRouter.delete('/:sessionId', (req: Request, res: Response) => {
  sessionStore.delete(req.params.sessionId);
  res.json({ cleared: true });
});
