import { describe, it, expect } from 'vitest';
import { isSupervisorToolInput, parseVerdict } from '../modules/supervisor/guards.js';
import { Verdict } from '../shared/enums.js';

describe('isSupervisorToolInput', () => {
  it('returns true for valid input with verdict', () => {
    expect(isSupervisorToolInput({ verdict: 'PASS', reasoning: 'Looks good' })).toBe(true);
  });

  it('returns true for input with only verdict field', () => {
    expect(isSupervisorToolInput({ verdict: 'REFINE' })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isSupervisorToolInput(null)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isSupervisorToolInput('PASS')).toBe(false);
    expect(isSupervisorToolInput(42)).toBe(false);
  });

  it('returns false when verdict field is missing', () => {
    expect(isSupervisorToolInput({ reasoning: 'no verdict here' })).toBe(false);
  });

  it('returns false when verdict is not a string', () => {
    expect(isSupervisorToolInput({ verdict: 123 })).toBe(false);
  });
});

describe('parseVerdict', () => {
  it('returns Verdict.Pass for PASS', () => {
    expect(parseVerdict('PASS')).toBe(Verdict.Pass);
  });

  it('returns Verdict.Refine for REFINE', () => {
    expect(parseVerdict('REFINE')).toBe(Verdict.Refine);
  });

  it('returns Verdict.Clarify for CLARIFY', () => {
    expect(parseVerdict('CLARIFY')).toBe(Verdict.Clarify);
  });

  it('falls back to Verdict.Pass for unknown string', () => {
    expect(parseVerdict('UNKNOWN')).toBe(Verdict.Pass);
    expect(parseVerdict('')).toBe(Verdict.Pass);
  });
});
