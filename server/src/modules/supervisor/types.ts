import { Verdict } from '../../shared/enums.js';

export { Verdict };

export interface SupervisorResult {
  verdict: Verdict;
  reasoning: string;
  feedback?: string;
  question?: string;
}

const MAX_RETRIES = 3;

export async function runWithRetry(
  name: string,
  fn: () => Promise<SupervisorResult>,
): Promise<SupervisorResult> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await fn();
    if (result.reasoning && result.reasoning !== 'Supervisor returned no reasoning — defaulting to PASS') {
      return result;
    }
    console.warn(`[${name}] attempt ${attempt}/${MAX_RETRIES} returned no reasoning — retrying`);
  }
  console.warn(`[${name}] all ${MAX_RETRIES} attempts returned no reasoning — falling back to PASS`);
  return { verdict: Verdict.Pass, reasoning: `Fallback to PASS after ${MAX_RETRIES} attempts without reasoning` };
}
