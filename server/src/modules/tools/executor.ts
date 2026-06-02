import { DataSource, DataType, Verdict } from '../../shared/enums.js';
import { getWeather } from '../api/apis/weather.js';
import { getCountryInfo } from '../api/apis/countries.js';
import { getAttractions } from '../api/apis/attractions.js';
import { getExchangeRate } from '../api/apis/exchangeRate.js';
import { searchKb } from '../rag/index.js';
import { runDataSupervisor } from '../supervisor/supervisors/data.js';
import { log } from '../../utils/logger.js';
import type { ToolExecutionResult } from './types.js';
import type { ToolCache } from '../session/types.js';

const REASONING_TOOLS = new Set([
  'think_destination_recommendation',
  'think_packing_advice',
  'think_local_attractions',
  'think_trip_plan',
]);

const CACHEABLE_TOOLS = new Set([
  'get_weather',
  'get_country_info',
  'get_attractions',
  'get_exchange_rate',
]);

function normalizeValue(value: string): string {
  return value.split(',')[0].trim().toLowerCase();
}

export function buildCacheKey(toolName: string, toolInput: Record<string, string>): string {
  const normalized = Object.fromEntries(
    Object.entries(toolInput).map(([k, v]) => [k, normalizeValue(v)])
  );
  return `${toolName}:${JSON.stringify(normalized)}`;
}

export async function executeTool(
  toolName: string,
  toolInput: Record<string, string>,
  toolCache?: ToolCache,
): Promise<ToolExecutionResult> {
  log.toolCall(toolName, toolInput);

  // Check cache for API tools
  if (toolCache && CACHEABLE_TOOLS.has(toolName)) {
    const key = buildCacheKey(toolName, toolInput);
    const cached = toolCache.get(key);
    if (cached) {
      console.log(`[cache] hit for ${toolName} — skipping API call`);
      return cached.result;
    }
  }

  let result: ToolExecutionResult;

  if (toolName === 'get_weather') {
    const city = toolInput.city;
    const weather = await getWeather(city);
    const context = toolInput.country ? `weather for ${city}, ${toolInput.country}` : `weather for ${city}`;
    const dataResult = await runDataSupervisor(context, weather, DataType.Weather);

    if (dataResult.verdict === Verdict.Clarify) {
      console.warn(`[data-supervisor] weather ambiguous: ${dataResult.question}`);
      return { content: '', source: '', clarification: dataResult.question };
    }
    if (dataResult.verdict === Verdict.Refine) {
      console.warn(`[data-supervisor] weather data rejected: ${dataResult.feedback ?? 'no feedback'}`);
      return {
        content: `Could not get reliable weather data for "${city}". Use your general knowledge about the climate there.`,
        source: '',
      };
    }

    result = {
      content:
        `Current weather in ${weather.city}, ${weather.country}:\n` +
        `Temperature: ${weather.temperature}°C (feels like ${weather.feelsLike}°C)\n` +
        `Conditions: ${weather.description}\n` +
        `Humidity: ${weather.humidity}% | Wind: ${weather.windSpeed} m/s`,
      source: DataSource.OpenWeatherMap,
    };
  } else if (toolName === 'get_country_info') {
    const country = toolInput.country;
    const info = await getCountryInfo(country);
    const dataResult = await runDataSupervisor(`country info for ${country} — user is planning a trip there`, info, DataType.CountryInfo);

    if (dataResult.verdict === Verdict.Clarify) {
      console.warn(`[data-supervisor] country ambiguous: ${dataResult.question}`);
      return { content: '', source: '', clarification: dataResult.question };
    }
    if (dataResult.verdict === Verdict.Refine) {
      console.warn(`[data-supervisor] country data rejected: ${dataResult.feedback ?? 'no feedback'}`);
      return {
        content: `Could not get reliable data for "${country}". Use your general knowledge.`,
        source: '',
      };
    }

    result = {
      content:
        `${info.name} (${info.region}):\n` +
        `Capital: ${info.capital}\n` +
        `Currency: ${info.currencies.join(', ')}\n` +
        `Languages: ${info.languages.join(', ')}\n` +
        `Population: ${info.population.toLocaleString()}`,
      source: DataSource.RestCountries,
    };
  } else if (toolName === 'get_attractions') {
    const location = toolInput.location;
    const attractions = await getAttractions(location);

    console.log(`[opentripmap] ${attractions.length} results for "${location}"`);

    if (!attractions.length) {
      console.warn(`[opentripmap] no results — falling back to LLM knowledge`);
      return {
        content: `No attraction data found for "${location}". Use your general knowledge about things to do there.`,
        source: '',
      };
    }

    const list = attractions.map((a, i) => `${i + 1}. ${a.name} (${a.kinds})`).join('\n');
    const description = `Attractions fetched for "${location}":\n${list}`;
    const dataResult = await runDataSupervisor(`attractions in ${location}`, description, DataType.Attractions);

    console.log(`[data-supervisor] attractions: ${dataResult.verdict}`);

    if (dataResult.verdict === Verdict.Refine) {
      console.warn(`[data-supervisor] attractions rejected: ${dataResult.feedback ?? 'no feedback'}`);
      return {
        content: `Could not get reliable attractions data for "${location}". Use your general knowledge about things to do there.`,
        source: '',
      };
    }

    result = {
      content: `Top attractions in ${location}:\n${list}`,
      source: DataSource.OpenTripMap,
    };
  } else if (toolName === 'get_exchange_rate') {
    const { from_currency, to_currency } = toolInput;
    const rate = await getExchangeRate(from_currency, to_currency);
    result = {
      content: `Live exchange rate (${rate.date}):\n1 ${rate.base} = ${rate.rate} ${rate.target}`,
      source: DataSource.Frankfurter,
    };
  } else if (toolName === 'search_travel_kb') {
    const { query } = toolInput;
    const docs = await searchKb(query, 3);
    if (!docs.length) {
      return { content: 'No relevant knowledge base results found. Use your general knowledge.', source: '' };
    }
    const content = docs.map((d) => `[${d.destination} — ${d.source}]\n${d.content}`).join('\n\n---\n\n');
    console.log(`[rag] query: "${query}" → ${docs.length} docs: ${docs.map((d) => d.id).join(', ')}`);
    return { content, source: DataSource.KnowledgeBase };
  } else if (REASONING_TOOLS.has(toolName)) {
    console.log(`[tool] reasoning tool ${toolName} — no execution needed`);
    return { content: 'Reasoning complete. Now provide your response based on this structured thinking.', source: '' };
  } else {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Store successful result in cache
  if (toolCache && CACHEABLE_TOOLS.has(toolName) && result.source) {
    const key = buildCacheKey(toolName, toolInput);
    toolCache.set(key, { result, cachedAt: Date.now() });
    console.log(`[cache] stored ${toolName}`);
  }

  return result;
}

export function buildCacheContextBlock(toolCache: ToolCache): string {
  if (!toolCache.size) return '';

  const SESSION_TTL_MS = 15 * 60 * 1000;
  const lines = [...toolCache.entries()]
    .filter(([, entry]) => Date.now() - entry.cachedAt < SESSION_TTL_MS)
    .filter(([, entry]) => entry.result.source && entry.result.content)
    .map(([key, entry]) => {
      const toolName = key.split(':')[0];
      const firstLine = entry.result.content.split('\n')[0];
      return `- ${toolName}: ${firstLine}`;
    });

  if (!lines.length) return '';
  return lines.join('\n');
}
