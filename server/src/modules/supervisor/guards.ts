import { Verdict } from '../../shared/enums.js';

export interface SupervisorToolInput {
  verdict: string;
  reasoning?: string;
  feedback?: string;
  question?: string;
}

export function isSupervisorToolInput(value: unknown): value is SupervisorToolInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'verdict' in value &&
    typeof (value as Record<string, unknown>).verdict === 'string'
  );
}

export function parseVerdict(value: string): Verdict {
  const valid = Object.values(Verdict) as string[];
  if (valid.includes(value)) return value as Verdict;
  return Verdict.Pass;
}
