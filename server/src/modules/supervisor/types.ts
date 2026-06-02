import { Verdict } from '../../shared/enums.js';
import { MAX_SUPERVISOR_RETRIES } from '../../shared/constants.js';

export { Verdict };

export interface SupervisorResult {
  verdict: Verdict;
  reasoning: string;
  feedback?: string;
  question?: string;
}

export async function runWithRetry(
  name: string,
  fn: () => Promise<SupervisorResult>,
): Promise<SupervisorResult> {
  for (let attempt = 1; attempt <= MAX_SUPERVISOR_RETRIES; attempt++) {
    const result = await fn();
    if (result.reasoning && result.reasoning !== 'Supervisor returned no reasoning — defaulting to PASS') {
      return result;
    }
    console.warn(`[${name}] attempt ${attempt}/${MAX_SUPERVISOR_RETRIES} returned no reasoning — retrying`);
  }
  console.warn(`[${name}] all ${MAX_SUPERVISOR_RETRIES} attempts returned no reasoning — falling back to PASS`);
  return { verdict: Verdict.Pass, reasoning: `Fallback to PASS after ${MAX_SUPERVISOR_RETRIES} attempts without reasoning` };
}
