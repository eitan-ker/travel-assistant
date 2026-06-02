import { describe, it, expect } from 'vitest';
import { formatUserContext } from '../modules/session/userContext.js';
import type { UserContext } from '../modules/session/types.js';

describe('formatUserContext', () => {
  it('returns null for empty context', () => {
    expect(formatUserContext({})).toBeNull();
  });

  it('returns null when all fields are undefined', () => {
    const ctx: UserContext = { destination: undefined, origin: undefined };
    expect(formatUserContext(ctx)).toBeNull();
  });

  it('formats destination', () => {
    const result = formatUserContext({ destination: 'Tokyo, Japan' });
    expect(result).toContain('Destination: Tokyo, Japan');
  });

  it('formats origin', () => {
    const result = formatUserContext({ origin: 'Tel Aviv' });
    expect(result).toContain('From: Tel Aviv');
  });

  it('formats passport', () => {
    const result = formatUserContext({ passport: 'Israeli' });
    expect(result).toContain('Passport: Israeli');
  });

  it('formats interests array', () => {
    const result = formatUserContext({ interests: ['food', 'culture', 'nightlife'] });
    expect(result).toContain('Interests: food, culture, nightlife');
  });

  it('skips empty interests array', () => {
    const result = formatUserContext({ interests: [] });
    expect(result).toBeNull();
  });

  it('formats full context as multiline string', () => {
    const ctx: UserContext = {
      destination: 'Paris, France',
      origin: 'Ramat Gan',
      passport: 'Israeli',
      budget: '20K ILS',
      travelStyle: 'explorer',
      tripDuration: '2 weeks',
      travelGroup: 'solo',
      interests: ['food', 'culture'],
      travelerConstraints: 'vegetarian',
    };
    const result = formatUserContext(ctx);
    expect(result).toContain('Destination: Paris, France');
    expect(result).toContain('From: Ramat Gan');
    expect(result).toContain('Passport: Israeli');
    expect(result).toContain('Budget: 20K ILS');
    expect(result).toContain('Constraints: vegetarian');
    const lines = result!.split('\n');
    expect(lines.length).toBeGreaterThan(3);
  });
});
