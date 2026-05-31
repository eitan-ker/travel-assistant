import type { Message } from '../llm/provider.js';

const sessions = new Map<string, Message[]>();

export const sessionStore = {
  get(sessionId: string): Message[] {
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }
    return sessions.get(sessionId)!;
  },
  set(sessionId: string, messages: Message[]) {
    sessions.set(sessionId, messages);
  },
  delete(sessionId: string) {
    sessions.delete(sessionId);
  },
};
