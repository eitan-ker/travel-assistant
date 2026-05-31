import { classifyIntent } from '../intent/router.js';
import { getWeather } from '../apis/weather.js';
import { getCountryInfo } from '../apis/countries.js';
import { SYSTEM_PROMPT, CHAIN_OF_THOUGHT_PROMPT } from '../prompts/system.js';
import type { Message } from '../llm/provider.js';

export interface BuiltContext {
  messages: Message[];
  sources: string[];
}

export async function buildContext(history: Message[], userMessage: string): Promise<BuiltContext> {
  const intent = classifyIntent(userMessage);
  const sources: string[] = ['Claude'];
  const injections: string[] = [];

  console.log(`[intent] ${intent.type}${intent.entity ? ` → "${intent.entity}"` : ''}`);

  if (intent.type === 'weather' && intent.entity) {
    try {
      const weather = await getWeather(intent.entity);
      injections.push(
        `[Live Data — OpenWeatherMap]\n` +
        `City: ${weather.city}, ${weather.country}\n` +
        `Temperature: ${weather.temperature}°C (feels like ${weather.feelsLike}°C)\n` +
        `Conditions: ${weather.description}\n` +
        `Humidity: ${weather.humidity}% | Wind: ${weather.windSpeed} m/s\n` +
        `Use this real-time data to inform your response.`
      );
      sources.push('OpenWeatherMap');
    } catch (err) {
      console.warn('[weather] fetch failed:', err instanceof Error ? err.message : err);
      injections.push(`[Note] Could not fetch live weather for "${intent.entity}". Use your general knowledge.`);
    }
  }

  if (intent.type === 'country_info' && intent.entity) {
    try {
      const country = await getCountryInfo(intent.entity);
      injections.push(
        `[Live Data — RestCountries]\n` +
        `Country: ${country.name} (${country.region})\n` +
        `Capital: ${country.capital}\n` +
        `Currency: ${country.currencies.join(', ')}\n` +
        `Languages: ${country.languages.join(', ')}\n` +
        `Population: ${country.population.toLocaleString()}\n` +
        `Use this data to ground your response.`
      );
      sources.push('RestCountries');
    } catch (err) {
      console.warn('[countries] fetch failed:', err instanceof Error ? err.message : err);
      injections.push(`[Note] Could not fetch country info for "${intent.entity}". Use your general knowledge.`);
    }
  }

  const systemContent = injections.length > 0
    ? `${SYSTEM_PROMPT}\n\n${injections.join('\n\n')}`
    : SYSTEM_PROMPT;

  const messages: Message[] = [{ role: 'system', content: systemContent }];

  if (intent.type === 'destination_rec') {
    messages.push({ role: 'system', content: CHAIN_OF_THOUGHT_PROMPT });
  }

  const conversationHistory = history.filter((m) => m.role !== 'system');
  messages.push(...conversationHistory);

  return { messages, sources };
}
