import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCountryInfo } from '../modules/api/apis/countries.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const VALID_RESPONSE = [{
  name: { common: 'Israel' },
  capital: ['Jerusalem'],
  region: 'Asia',
  population: 9000000,
  currencies: { ILS: { name: 'Israeli new shekel' } },
  languages: { heb: 'Hebrew', ara: 'Arabic' },
}];

beforeEach(() => {
  mockFetch.mockReset();
});

describe('getCountryInfo', () => {
  it('returns country data on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(VALID_RESPONSE) });

    const result = await getCountryInfo('Israel');

    expect(result.name).toBe('Israel');
    expect(result.capital).toBe('Jerusalem');
    expect(result.region).toBe('Asia');
    expect(result.currencies).toContain('Israeli new shekel');
    expect(result.languages).toContain('Hebrew');
  });

  it('throws when response array is empty', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

    await expect(getCountryInfo('UnknownCountry')).rejects.toThrow('Country not found');
  });

  it('throws on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(getCountryInfo('Narnia')).rejects.toThrow('Country not found');
  });

  it('throws on other API errors', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(getCountryInfo('Israel')).rejects.toThrow('Countries API error: 500');
  });

  it('handles missing capital gracefully', async () => {
    const noCapital = [{ ...VALID_RESPONSE[0], capital: [] }];
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(noCapital) });

    const result = await getCountryInfo('Israel');
    expect(result.capital).toBe('N/A');
  });
});
