import { getWeather } from '../apis/weather.js';
import { getCountryInfo } from '../apis/countries.js';
import { getAttractions } from '../apis/attractions.js';
import { getExchangeRate } from '../apis/exchangeRate.js';
import { runDataSupervisor } from '../supervisor/dataSupervisor.js';
import { log } from '../utils/logger.js';

export interface ToolExecutionResult {
  content: string;
  source: string;
}

export async function executeTool(
  toolName: string,
  toolInput: Record<string, string>,
): Promise<ToolExecutionResult> {
  log.toolCall(toolName, toolInput);

  if (toolName === 'get_weather') {
    const city = toolInput.city;
    const weather = await getWeather(city);

    const dataResult = await runDataSupervisor(
      `weather for ${city}`,
      weather,
      'weather',
    );

    if (dataResult.verdict === 'REFINE') {
      console.warn(`[data-supervisor] weather data rejected: ${dataResult.feedback}`);
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
      source: 'OpenWeatherMap',
    };
  }

  if (toolName === 'get_country_info') {
    const country = toolInput.country;
    const info = await getCountryInfo(country);

    const dataResult = await runDataSupervisor(
      `country info for ${country}`,
      info,
      'country_info',
    );

    if (dataResult.verdict === 'REFINE') {
      console.warn(`[data-supervisor] country data rejected: ${dataResult.feedback}`);
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
      source: 'RestCountries',
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

    const dataResult = await runDataSupervisor(`attractions in ${city}`, description, 'attractions');
    console.log(`[data-supervisor] attractions: ${dataResult.verdict}`);

    if (dataResult.verdict === 'REFINE') {
      console.warn(`[data-supervisor] attractions rejected: ${dataResult.feedback}`);
      return {
        content: `Could not get reliable attractions data for "${city}". Use your general knowledge about things to do there.`,
        source: '',
      };
    }

    return {
      content: `Top attractions in ${city}:\n${list}`,
      source: 'OpenTripMap',
    };
  }

  if (toolName === 'get_exchange_rate') {
    const { from_currency, to_currency } = toolInput;
    const rate = await getExchangeRate(from_currency, to_currency);
    return {
      content: `Live exchange rate (${rate.date}):\n1 ${rate.base} = ${rate.rate} ${rate.target}`,
      source: 'Frankfurter',
    };
  }

  // Reasoning tools — no execution needed, Claude uses the input to structure its response
  if (['think_destination_recommendation', 'think_packing_advice', 'think_local_attractions', 'think_trip_plan'].includes(toolName)) {
    console.log(`[tool] reasoning tool ${toolName} — no execution needed`);
    return {
      content: 'Reasoning complete. Now provide your response based on this structured thinking.',
      source: '',
    };
  }

  throw new Error(`Unknown tool: ${toolName}`);
}
