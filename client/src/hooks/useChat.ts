import { useState, useCallback, useRef, useEffect } from 'react';
import { sendMessage, clearSession } from '../api/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  error?: boolean;
}

const STORAGE_KEY = 'travel_chat';
const SESSION_TTL_MS = 15 * 60 * 1000;

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function loadFromStorage(): { sessionId: string; messages: ChatMessage[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const age = Date.now() - (parsed.savedAt ?? 0);
      if (age < SESSION_TTL_MS) return parsed;
      console.log('[session] expired after 15min — starting fresh');
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
  return { sessionId: generateId(), messages: [] };
}

export function useChat() {
  const stored = useRef(loadFromStorage());
  const [messages, setMessages] = useState<ChatMessage[]>(stored.current.messages);
  const [loading, setLoading] = useState(false);
  const sessionId = useRef(stored.current.sessionId);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId: sessionId.current, messages, savedAt: Date.now() }));
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { id: generateId(), role: 'user', content: text };
    console.log('[user]', text);
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const { reply, sources } = await sendMessage(text, sessionId.current);
      const assistantMsg: ChatMessage = { id: generateId(), role: 'assistant', content: reply, sources };
      console.log('[assistant]', { reply, sources });
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        error: true,
      };
      console.error('[error]', err);
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    await clearSession(sessionId.current);
    sessionId.current = generateId();
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { messages, loading, send, clear };
}
