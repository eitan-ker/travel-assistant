export type Verdict = 'PASS' | 'REFINE';

export interface SupervisorResult {
  verdict: Verdict;
  reasoning: string;
  feedback?: string;
}
