import { describe, it, expect, vi } from 'vitest';
import { runWithRetry } from '../modules/supervisor/types.js';
import { Verdict } from '../shared/enums.js';

describe('runWithRetry', () => {
  it('returns result immediately on first valid response', async () => {
    const fn = vi.fn().mockResolvedValue({ verdict: Verdict.Pass, reasoning: 'Looks good' });

    const result = await runWithRetry('test', fn);

    expect(result.verdict).toBe(Verdict.Pass);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries when reasoning is empty', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ verdict: Verdict.Pass, reasoning: '' })
      .mockResolvedValueOnce({ verdict: Verdict.Refine, reasoning: 'Tool missing' });

    const result = await runWithRetry('test', fn);

    expect(result.verdict).toBe(Verdict.Refine);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('falls back to PASS after 3 attempts with no reasoning', async () => {
    const fn = vi.fn().mockResolvedValue({ verdict: Verdict.Refine, reasoning: '' });

    const result = await runWithRetry('test', fn);

    expect(result.verdict).toBe(Verdict.Pass);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('returns CLARIFY verdict when reasoning is present', async () => {
    const fn = vi.fn().mockResolvedValue({
      verdict: Verdict.Clarify,
      reasoning: 'Ambiguous city',
      question: 'Did you mean Paris, France or Paris, Texas?',
    });

    const result = await runWithRetry('test', fn);

    expect(result.verdict).toBe(Verdict.Clarify);
    expect(result.question).toBe('Did you mean Paris, France or Paris, Texas?');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns on second attempt if first has no reasoning', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ verdict: Verdict.Pass, reasoning: '' })
      .mockResolvedValueOnce({ verdict: Verdict.Pass, reasoning: 'Tool selection correct' });

    const result = await runWithRetry('test', fn);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.reasoning).toBe('Tool selection correct');
  });
});
