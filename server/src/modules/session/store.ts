import type { Message } from '../../shared/types.js';
import type { UserContext } from './types.js';

interface Session {
  messages: Message[];
  userContext: UserContext;
}

const sessions = new Map<string, Session>();

function emptySession(): Session {
  return { messages: [], userContext: {} };
}

export const sessionStore = {
  get(sessionId: string): Session {
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, emptySession());
    }
    return sessions.get(sessionId)!;
  },
  set(sessionId: string, session: Session) {
    sessions.set(sessionId, session);
  },
  delete(sessionId: string) {
    sessions.delete(sessionId);
  },
};
