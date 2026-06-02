import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from '../hooks/useChat';
import * as client from '../api/client';

vi.mock('../api/client');

const STORAGE_KEY = 'travel_chat';

function setStorage(value: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

describe('loadFromStorage', () => {
  it('returns fresh session when localStorage is empty', () => {
    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toEqual([]);
  });

  it('restores session when within TTL', () => {
    const messages = [{ id: '1', role: 'user', content: 'Hello', }];
    setStorage({ sessionId: 'stored-id', messages, savedAt: Date.now() });

    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Hello');
  });

  it('returns fresh session when TTL expired', () => {
    const messages = [{ id: '1', role: 'user', content: 'Old message' }];
    const expiredTime = Date.now() - 16 * 60 * 1000; // 16 minutes ago
    setStorage({ sessionId: 'old-id', messages, savedAt: expiredTime });

    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toEqual([]);
  });

  it('returns fresh session when localStorage has corrupt data', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{');

    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toEqual([]);
  });

  it('returns fresh session when localStorage has wrong shape', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar', savedAt: Date.now() }));

    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toEqual([]);
  });
});

describe('send', () => {
  it('does nothing when text is empty', async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.send(''); });
    await act(async () => { await result.current.send('   '); });

    expect(client.sendMessage).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('adds user message immediately', async () => {
    vi.mocked(client.sendMessage).mockResolvedValue({
      reply: 'Great choice!',
      sessionId: 'abc',
      sources: ['Claude'],
      toolsUsed: [],
      supervisors: [],
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.send('I want to go to Tokyo');
    });

    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('I want to go to Tokyo');
  });

  it('adds assistant message on success', async () => {
    vi.mocked(client.sendMessage).mockResolvedValue({
      reply: 'Tokyo is amazing!',
      sessionId: 'abc',
      sources: ['Claude', 'OpenWeatherMap'],
      toolsUsed: ['get_weather'],
      supervisors: [{ name: 'Intent Supervisor', verdict: 'PASS' }],
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.send('Tokyo weather?');
    });

    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.role).toBe('assistant');
    expect(assistantMsg.content).toBe('Tokyo is amazing!');
    expect(assistantMsg.sources).toEqual(['Claude', 'OpenWeatherMap']);
    expect(assistantMsg.error).toBeUndefined();
  });

  it('adds error message on failure', async () => {
    vi.mocked(client.sendMessage).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.send('Hello');
    });

    const errorMsg = result.current.messages[1];
    expect(errorMsg.role).toBe('assistant');
    expect(errorMsg.error).toBe(true);
    expect(errorMsg.content).toBe('Something went wrong. Please refresh or try again later.');
  });

  it('sets loading true during request and false after', async () => {
    let resolveMessage!: (value: client.ChatResponse) => void;
    vi.mocked(client.sendMessage).mockReturnValue(
      new Promise<client.ChatResponse>((resolve) => { resolveMessage = resolve; })
    );

    const { result } = renderHook(() => useChat());

    act(() => { result.current.send('Hello'); });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveMessage({ reply: 'Hi', sessionId: 'abc', sources: [], toolsUsed: [], supervisors: [] });
    });
    expect(result.current.loading).toBe(false);
  });

  it('updates userContext from response', async () => {
    vi.mocked(client.sendMessage).mockResolvedValue({
      reply: 'Great!',
      sessionId: 'abc',
      sources: [],
      toolsUsed: [],
      supervisors: [],
      userContext: { destination: 'Tokyo, Japan', passport: 'Israeli' },
    });

    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.send('I want to go to Tokyo'); });

    expect(result.current.userContext.destination).toBe('Tokyo, Japan');
    expect(result.current.userContext.passport).toBe('Israeli');
  });

  it('does not send if already loading', async () => {
    let resolveFirst!: (value: client.ChatResponse) => void;
    vi.mocked(client.sendMessage).mockReturnValueOnce(
      new Promise<client.ChatResponse>((resolve) => { resolveFirst = resolve; })
    );

    const { result } = renderHook(() => useChat());

    // Start first send — leaves loading: true
    act(() => { result.current.send('First message'); });
    expect(result.current.loading).toBe(true);

    // Second send while loading — should be ignored
    await act(async () => { await result.current.send('Second message'); });

    expect(client.sendMessage).toHaveBeenCalledTimes(1);

    // Resolve first
    await act(async () => {
      resolveFirst({ reply: 'Hi', sessionId: 'abc', sources: [], toolsUsed: [], supervisors: [] });
    });
  });

  it('marks clarification messages', async () => {
    vi.mocked(client.sendMessage).mockResolvedValue({
      reply: 'Did you mean Paris, France or Paris, Texas?',
      sessionId: 'abc',
      sources: [],
      toolsUsed: [],
      supervisors: [{ name: 'Intent Supervisor', verdict: 'CLARIFY' }],
      isClarification: true,
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.send('What is the weather in Paris?');
    });

    expect(result.current.messages[1].isClarification).toBe(true);
  });
});

describe('clear', () => {
  it('resets messages and userContext', async () => {
    vi.mocked(client.sendMessage).mockResolvedValue({
      reply: 'Hi!',
      sessionId: 'abc',
      sources: [],
      toolsUsed: [],
      supervisors: [],
    });
    vi.mocked(client.clearSession).mockResolvedValue(undefined);

    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.send('Hello'); });
    expect(result.current.messages).toHaveLength(2);

    await act(async () => { await result.current.clear(); });

    expect(result.current.messages).toEqual([]);
    expect(result.current.userContext).toEqual({});
  });

  it('calls clearSession on the server when clearing', async () => {
    vi.mocked(client.clearSession).mockResolvedValue(undefined);

    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.clear(); });

    expect(client.clearSession).toHaveBeenCalledOnce();
  });

  it('generates a new session ID after clear — not the same as before', async () => {
    vi.mocked(client.clearSession).mockResolvedValue(undefined);

    const { result } = renderHook(() => useChat());
    const originalSessionId = JSON.parse(localStorage.getItem('travel_chat') ?? '{}').sessionId;

    await act(async () => { await result.current.clear(); });

    const newSessionId = JSON.parse(localStorage.getItem('travel_chat') ?? '{}').sessionId;
    expect(newSessionId).toBeDefined();
    expect(newSessionId).not.toBe(originalSessionId);
  });

  it('persists new empty session to localStorage after clear so refresh stays in new chat', async () => {
    vi.mocked(client.clearSession).mockResolvedValue(undefined);

    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.clear(); });

    const stored = JSON.parse(localStorage.getItem('travel_chat') ?? 'null');
    expect(stored).not.toBeNull();
    expect(stored.messages).toEqual([]);
    expect(stored.sessionId).toBeDefined();
    expect(stored.savedAt).toBeGreaterThan(0);
  });
});
