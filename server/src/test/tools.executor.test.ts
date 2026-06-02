import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from '../modules/tools/executor.js';
import { DataSource, Verdict } from '../shared/enums.js';

vi.mock('../modules/integrations/weather.js', () => ({
  getWeather: vi.fn(),
}));
vi.mock('../modules/integrations/countries.js', () => ({
  getCountryInfo: vi.fn(),
}));
vi.mock('../modules/integrations/attractions.js', () => ({
  getAttractions: vi.fn(),
}));
vi.mock('../modules/integrations/exchangeRate.js', () => ({
  getExchangeRate: vi.fn(),
}));
vi.mock('../modules/rag/index.js', () => ({
  searchKb: vi.fn(),
}));
vi.mock('../modules/supervisor/data.js', () => ({
  runDataSupervisor: vi.fn(),
}));
vi.mock('../utils/logger.js', () => ({
  log: { toolCall: vi.fn() },
}));

import { getWeather } from '../modules/integrations/weather.js';
import { getCountryInfo } from '../modules/integrations/countries.js';
import { getAttractions } from '../modules/integrations/attractions.js';
import { getExchangeRate } from '../modules/integrations/exchangeRate.js';
import { searchKb } from '../modules/rag/index.js';
import { runDataSupervisor } from '../modules/supervisor/data.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeTool — get_weather', () => {
  it('returns weather content on PASS', async () => {
    vi.mocked(getWeather).mockResolvedValue({
      city: 'Tokyo', country: 'JP', temperature: 22, feelsLike: 21,
      description: 'clear sky', humidity: 50, windSpeed: 3,
    });
    vi.mocked(runDataSupervisor).mockResolvedValue({ verdict: Verdict.Pass, reasoning: 'ok' });

    const result = await executeTool('get_weather', { city: 'Tokyo' });

    expect(result.source).toBe(DataSource.OpenWeatherMap);
    expect(result.content).toContain('Tokyo');
    expect(result.content).toContain('22°C');
  });

  it('returns fallback content on REFINE', async () => {
    vi.mocked(getWeather).mockResolvedValue({
      city: 'Netanya', country: 'IL', temperature: 27, feelsLike: 29,
      description: 'sunny', humidity: 67, windSpeed: 4,
    });
    vi.mocked(runDataSupervisor).mockResolvedValue({ verdict: Verdict.Refine, reasoning: 'wrong city', feedback: 'wrong geo' });

    const result = await executeTool('get_weather', { city: 'Netanya' });

    expect(result.source).toBe('');
    expect(result.content).toContain('general knowledge');
  });

  it('returns clarification on CLARIFY', async () => {
    vi.mocked(getWeather).mockResolvedValue({
      city: 'Paris', country: 'TX', temperature: 35, feelsLike: 37,
      description: 'hot', humidity: 30, windSpeed: 2,
    });
    vi.mocked(runDataSupervisor).mockResolvedValue({
      verdict: Verdict.Clarify,
      reasoning: 'ambiguous',
      question: 'Did you mean Paris, France or Paris, Texas?',
    });

    const result = await executeTool('get_weather', { city: 'Paris' });

    expect(result.clarification).toBe('Did you mean Paris, France or Paris, Texas?');
    expect(result.content).toBe('');
  });
});

describe('executeTool — get_country_info', () => {
  it('returns country content on PASS', async () => {
    vi.mocked(getCountryInfo).mockResolvedValue({
      name: 'Japan', capital: 'Tokyo', region: 'Asia',
      population: 125000000, currencies: ['Japanese yen'], languages: ['Japanese'],
    });
    vi.mocked(runDataSupervisor).mockResolvedValue({ verdict: Verdict.Pass, reasoning: 'ok' });

    const result = await executeTool('get_country_info', { country: 'Japan' });

    expect(result.source).toBe(DataSource.RestCountries);
    expect(result.content).toContain('Japan');
    expect(result.content).toContain('Tokyo');
  });

  it('returns clarification on CLARIFY', async () => {
    vi.mocked(getCountryInfo).mockResolvedValue({
      name: 'Georgia', capital: 'Tbilisi', region: 'Asia',
      population: 4000000, currencies: ['Georgian lari'], languages: ['Georgian'],
    });
    vi.mocked(runDataSupervisor).mockResolvedValue({
      verdict: Verdict.Clarify,
      reasoning: 'ambiguous',
      question: 'Did you mean Georgia the country or Georgia the US state?',
    });

    const result = await executeTool('get_country_info', { country: 'Georgia' });

    expect(result.clarification).toBeDefined();
  });
});

describe('executeTool — search_travel_kb', () => {
  it('returns KB results when found', async () => {
    vi.mocked(searchKb).mockResolvedValue([
      { id: 'tokyo-wikivoyage', destination: 'Tokyo', source: 'wikivoyage', summary: 'Tokyo guide', content: 'Great city', embedding: [] },
    ]);

    const result = await executeTool('search_travel_kb', { query: 'Tokyo tips' });

    expect(result.source).toBe(DataSource.KnowledgeBase);
    expect(result.content).toContain('Tokyo');
  });

  it('returns fallback when no KB results', async () => {
    vi.mocked(searchKb).mockResolvedValue([]);

    const result = await executeTool('search_travel_kb', { query: 'unknown place' });

    expect(result.source).toBe('');
    expect(result.content).toContain('general knowledge');
  });
});

describe('executeTool — reasoning tools', () => {
  it.each([
    'think_destination_recommendation',
    'think_packing_advice',
    'think_local_attractions',
    'think_trip_plan',
  ])('returns reasoning complete for %s', async (toolName) => {
    const result = await executeTool(toolName, {});

    expect(result.content).toContain('Reasoning complete');
    expect(result.source).toBe('');
  });
});

describe('executeTool — unknown tool', () => {
  it('throws for unknown tool name', async () => {
    await expect(executeTool('does_not_exist', {})).rejects.toThrow('Unknown tool: does_not_exist');
  });
});
