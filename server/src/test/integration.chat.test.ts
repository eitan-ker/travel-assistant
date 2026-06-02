import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { SupervisorVerdict } from '../shared/enums.js';

// Mock the full pipeline so we don't hit real LLMs or APIs
vi.mock('../modules/pipeline/index.js', () => ({
  runPipeline: vi.fn(),
}));

vi.mock('../modules/rag/index.js', () => ({
  loadKb: vi.fn(),
  searchKb: vi.fn(),
  getKb: vi.fn(() => []),
}));

import { runPipeline } from '../modules/pipeline/index.js';

const DEFAULT_PIPELINE_RESULT = {
  reply: 'Tokyo is a great destination!',
  sources: ['Claude', 'OpenWeatherMap'],
  toolsUsed: ['get_weather'],
  supervisors: [{ name: 'Intent Supervisor', verdict: SupervisorVerdict.Pass }],
  userContext: { destination: 'Tokyo, Japan' },
  isClarification: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(runPipeline).mockResolvedValue(DEFAULT_PIPELINE_RESULT);
});

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /chat', () => {
  it('returns reply on success', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ message: 'Tell me about Tokyo', sessionId: 'test-session' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Tokyo is a great destination!');
    expect(res.body.sources).toContain('Claude');
    expect(res.body.toolsUsed).toContain('get_weather');
  });

  it('returns 400 when message is missing', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ sessionId: 'test-session' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ message: 'Hello' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 500 when pipeline throws', async () => {
    vi.mocked(runPipeline).mockRejectedValue(new Error('LLM timeout'));

    const res = await request(app)
      .post('/chat')
      .send({ message: 'Hello', sessionId: 'test-session' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('LLM timeout');
  });

  it('includes isClarification in response', async () => {
    vi.mocked(runPipeline).mockResolvedValue({
      ...DEFAULT_PIPELINE_RESULT,
      reply: 'Did you mean Paris, France or Paris, Texas?',
      isClarification: true,
      sources: [],
      toolsUsed: [],
    });

    const res = await request(app)
      .post('/chat')
      .send({ message: 'Weather in Paris', sessionId: 'test-session' });

    expect(res.status).toBe(200);
    expect(res.body.isClarification).toBe(true);
    expect(res.body.reply).toContain('Did you mean');
  });

  it('persists session across multiple messages with correct history', async () => {
    const sessionId = 'multi-turn-session';

    await request(app)
      .post('/chat')
      .send({ message: 'I want to go to Tokyo', sessionId });

    await request(app)
      .post('/chat')
      .send({ message: 'What should I pack?', sessionId });

    expect(runPipeline).toHaveBeenCalledTimes(2);

    const secondCallHistory = vi.mocked(runPipeline).mock.calls[1][0];
    // History should contain user message and assistant reply from first turn
    const userMsg = secondCallHistory.find((m) => m.content === 'I want to go to Tokyo');
    const assistantMsg = secondCallHistory.find((m) => m.content === DEFAULT_PIPELINE_RESULT.reply);
    expect(userMsg).toBeDefined();
    expect(assistantMsg).toBeDefined();
  });

  it('includes userContext in response', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ message: 'I want to go to Tokyo', sessionId: 'test-session' });

    expect(res.body.userContext).toEqual({ destination: 'Tokyo, Japan' });
  });
});

describe('DELETE /chat/:sessionId', () => {
  it('clears a session', async () => {
    const sessionId = 'session-to-clear';

    // Create a session first
    await request(app)
      .post('/chat')
      .send({ message: 'Hello', sessionId });

    // Then clear it
    const res = await request(app).delete(`/chat/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.cleared).toBe(true);
  });

  it('returns cleared true even for non-existent session', async () => {
    const res = await request(app).delete('/chat/nonexistent-session');
    expect(res.status).toBe(200);
    expect(res.body.cleared).toBe(true);
  });
});
