import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMessage, clearSession } from '../api/client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('sendMessage', () => {
  it('returns parsed response on success', async () => {
    const payload = {
      reply: 'Tokyo is great!',
      sessionId: 'abc',
      sources: ['Claude'],
      toolsUsed: ['get_weather'],
      supervisors: [],
    };
    mockFetch.mockResolvedValue(makeResponse(200, payload));

    const result = await sendMessage('Tell me about Tokyo', 'abc');

    expect(result.reply).toBe('Tokyo is great!');
    expect(result.sources).toEqual(['Claude']);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/chat',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws with server error message on non-ok response', async () => {
    mockFetch.mockResolvedValue(makeResponse(500, { error: 'Internal server error' }));

    await expect(sendMessage('Hello', 'abc')).rejects.toThrow('Internal server error');
  });

  it('throws with status code when error body is unparseable', async () => {
    const brokenResponse = {
      ok: false,
      status: 503,
      json: () => Promise.reject(new Error('parse error')),
    } as unknown as Response;
    mockFetch.mockResolvedValue(brokenResponse);

    await expect(sendMessage('Hello', 'abc')).rejects.toThrow('Server error 503');
  });

  it('sends message and sessionId in request body', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { reply: 'ok', sessionId: 'xyz', sources: [], toolsUsed: [], supervisors: [] }));

    await sendMessage('Pack for Bali', 'xyz');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message).toBe('Pack for Bali');
    expect(body.sessionId).toBe('xyz');
  });
});

describe('clearSession', () => {
  it('calls DELETE on the session endpoint', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { cleared: true }));

    await clearSession('session-123');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/chat/session-123',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
