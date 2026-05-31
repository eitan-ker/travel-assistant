import { Router, Request, Response } from 'express';
import { sessionStore } from '../session/store.js';
import { runPipeline } from '../context/builder.js';

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
    const { reply, sources, toolsUsed, supervisors } = await runPipeline(history, message);

    history.push({ role: 'assistant', content: reply });
    sessionStore.set(sessionId, history);

    res.json({ reply, sessionId, sources, toolsUsed, supervisors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Request failed';
    res.status(500).json({ error: msg });
  }
});

chatRouter.delete('/:sessionId', (req: Request, res: Response) => {
  sessionStore.delete(req.params.sessionId);
  res.json({ cleared: true });
});
