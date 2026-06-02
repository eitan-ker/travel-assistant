import { DataSource, DataType, Verdict } from '../../shared/enums.js';
import { getWeather } from '../integrations/weather.js';
import { getCountryInfo } from '../integrations/countries.js';
import { getAttractions } from '../integrations/attractions.js';
import { getExchangeRate } from '../integrations/exchangeRate.js';
import { searchKb } from '../rag/index.js';
import { runDataSupervisor } from '../supervisor/data.js';
import { log } from '../../utils/logger.js';
import type { ToolExecutionResult } from './types.js';

const REASONING_TOOLS = new Set([
  'think_destination_recommendation',
  'think_packing_advice',
  'think_local_attractions',
  'think_trip_plan',
]);

export async function executeTool(
  toolName: string,
  toolInput: Record<string, string>,
): Promise<ToolExecutionResult> {
  log.toolCall(toolName, toolInput);

  if (toolName === 'get_weather') {
    const city = toolInput.city;
    const weather = await getWeather(city);
    const dataResult = await runDataSupervisor(`weather for ${city}`, weather, DataType.Weather);

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

    return {
      content:
        `Current weather in ${weather.city}, ${weather.country}:\n` +
        `Temperature: ${weather.temperature}°C (feels like ${weather.feelsLike}°C)\n` +
        `Conditions: ${weather.description}\n` +
        `Humidity: ${weather.humidity}% | Wind: ${weather.windSpeed} m/s`,
      source: DataSource.OpenWeatherMap,
    };
  }

  if (toolName === 'get_country_info') {
    const country = toolInput.country;
    const info = await getCountryInfo(country);
    const dataResult = await runDataSupervisor(`country info for ${country}`, info, DataType.CountryInfo);

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

    return {
      content:
        `${info.name} (${info.region}):\n` +
        `Capital: ${info.capital}\n` +
        `Currency: ${info.currencies.join(', ')}\n` +
        `Languages: ${info.languages.join(', ')}\n` +
        `Population: ${info.population.toLocaleString()}`,
      source: DataSource.RestCountries,
    };
  }

  if (toolName === 'get_attractions') {
    const city = toolInput.city;
    const attractions = await getAttractions(city);

    console.log(`[opentripmap] ${attractions.length} results for "${city}"`);

    if (!attractions.length) {
      console.warn(`[opentripmap] no results — falling back to LLM knowledge`);
      return {
        content: `No attraction data found for "${city}". Use your general knowledge about things to do there.`,
        source: '',
      };
    }

    const list = attractions.map((a, i) => `${i + 1}. ${a.name} (${a.kinds})`).join('\n');
    const description = `Attractions fetched for "${city}":\n${list}`;
    const dataResult = await runDataSupervisor(`attractions in ${city}`, description, DataType.Attractions);

    console.log(`[data-supervisor] attractions: ${dataResult.verdict}`);

    if (dataResult.verdict === Verdict.Refine) {
      console.warn(`[data-supervisor] attractions rejected: ${dataResult.feedback ?? 'no feedback'}`);
      return {
        content: `Could not get reliable attractions data for "${city}". Use your general knowledge about things to do there.`,
        source: '',
      };
    }

    return {
      content: `Top attractions in ${city}:\n${list}`,
      source: DataSource.OpenTripMap,
    };
  }

  if (toolName === 'get_exchange_rate') {
    const { from_currency, to_currency } = toolInput;
    const rate = await getExchangeRate(from_currency, to_currency);
    return {
      content: `Live exchange rate (${rate.date}):\n1 ${rate.base} = ${rate.rate} ${rate.target}`,
      source: DataSource.Frankfurter,
    };
  }

  if (toolName === 'search_travel_kb') {
    const { query } = toolInput;
    const docs = await searchKb(query, 3);
    if (!docs.length) {
      return { content: 'No relevant knowledge base results found. Use your general knowledge.', source: '' };
    }
    const result = docs.map((d) => `[${d.destination} — ${d.source}]\n${d.content}`).join('\n\n---\n\n');
    console.log(`[rag] query: "${query}" → ${docs.length} docs: ${docs.map((d) => d.id).join(', ')}`);
    return { content: result, source: DataSource.KnowledgeBase };
  }

  if (REASONING_TOOLS.has(toolName)) {
    console.log(`[tool] reasoning tool ${toolName} — no execution needed`);
    return { content: 'Reasoning complete. Now provide your response based on this structured thinking.', source: '' };
  }

  throw new Error(`Unknown tool: ${toolName}`);
}
