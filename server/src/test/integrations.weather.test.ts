import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWeather } from '../modules/integrations/weather.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const VALID_RESPONSE = {
  name: 'Netanya',
  sys: { country: 'IL' },
  main: { temp: 27.4, feels_like: 29.1, humidity: 67 },
  weather: [{ description: 'scattered clouds' }],
  wind: { speed: 4.2 },
};

beforeEach(() => {
  mockFetch.mockReset();
  process.env.OPENWEATHER_API_KEY = 'test-key';
});

describe('getWeather', () => {
  it('returns weather data for a city', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(VALID_RESPONSE) });

    const result = await getWeather('Netanya');

    expect(result.city).toBe('Netanya');
    expect(result.country).toBe('IL');
    expect(result.temperature).toBe(27);
    expect(result.humidity).toBe(67);
  });

  it('strips country suffix from city name before calling API', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(VALID_RESPONSE) });

    await getWeather('Netanya, Israel');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('q=Netanya');
    expect(url).not.toContain('Israel');
  });

  it('throws on 404 city not found', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(getWeather('UnknownCity')).rejects.toThrow('City not found');
  });

  it('throws on other API errors', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(getWeather('Tokyo')).rejects.toThrow('Weather API error: 500');
  });

  it('throws when API key is missing', async () => {
    delete process.env.OPENWEATHER_API_KEY;

    await expect(getWeather('Tokyo')).rejects.toThrow('OPENWEATHER_API_KEY is not set');
  });
});
