import { useState, useCallback, useRef, useEffect } from 'react';
import { sendMessage, clearSession, type SupervisorLog, type UserContext } from '../api/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  toolsUsed?: string[];
  supervisors?: SupervisorLog[];
  thinkingSeconds?: number;
  error?: boolean;
  isClarification?: boolean;
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
      const hasValidShape = typeof parsed.sessionId === 'string' && Array.isArray(parsed.messages);
      if (!hasValidShape) {
        console.warn('[session] invalid storage shape — starting fresh');
        localStorage.removeItem(STORAGE_KEY);
        return { sessionId: generateId(), messages: [] };
      }
      if (age < SESSION_TTL_MS) return parsed;
      console.log('[session] expired after 15min — starting fresh');
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[session] failed to load from storage — starting fresh', err);
    localStorage.removeItem(STORAGE_KEY);
  }
  return { sessionId: generateId(), messages: [] };
}

export function useChat() {
  const stored = useRef(loadFromStorage());
  const [messages, setMessages] = useState<ChatMessage[]>(stored.current.messages);
  const [loading, setLoading] = useState(false);
  const isLoadingRef = useRef(false);
  const [userContext, setUserContext] = useState<UserContext>({});
  const sessionId = useRef(stored.current.sessionId);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId: sessionId.current, messages, savedAt: Date.now() }));
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim()) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    const userMsg: ChatMessage = { id: generateId(), role: 'user', content: text };
    console.log('[user]', text);
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    const startTime = Date.now();

    try {
      const { reply, sources, toolsUsed, supervisors, userContext: newContext, isClarification } = await sendMessage(text, sessionId.current);
      const thinkingSeconds = Math.round((Date.now() - startTime) / 1000);
      const assistantMsg: ChatMessage = { id: generateId(), role: 'assistant', content: reply, sources, toolsUsed, supervisors, thinkingSeconds, isClarification };
      if (newContext) setUserContext(newContext);
      console.log('[assistant]', { reply, sources });
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('[error]', err);
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Something went wrong. Please refresh or try again later.',
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    await clearSession(sessionId.current);
    sessionId.current = generateId();
    setMessages([]);
    setUserContext({});
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { messages, loading, send, clear, userContext };
}
