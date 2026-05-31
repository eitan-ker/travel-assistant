import { classifyIntent, type IntentResult } from '../intent/router.js';
import { getWeather, type WeatherData } from '../apis/weather.js';
import { getCountryInfo, type CountryData } from '../apis/countries.js';
import { SYSTEM_PROMPT, CHAIN_OF_THOUGHT_PROMPT } from '../prompts/system.js';
import { runIntentSupervisor } from '../supervisor/intentSupervisor.js';
import { runDataSupervisor } from '../supervisor/dataSupervisor.js';
import { runResponseSupervisor } from '../supervisor/responseSupervisor.js';
import { getLLMProvider } from '../llm/factory.js';
import type { Message } from '../llm/provider.js';

const SUPERVISED_INTENTS = new Set(['destination_rec', 'packing', 'attractions', 'general']);

export interface BuiltContext {
  messages: Message[];
  sources: string[];
}

export interface PipelineResult {
  reply: string;
  sources: string[];
}

function buildMessages(intent: IntentResult, history: Message[], injection?: string): Message[] {
  const systemContent = injection
    ? `${SYSTEM_PROMPT}\n\n${injection}`
    : SYSTEM_PROMPT;

  const messages: Message[] = [{ role: 'system', content: systemContent }];

  if (intent.type === 'destination_rec') {
    messages.push({ role: 'system', content: CHAIN_OF_THOUGHT_PROMPT });
  }

  messages.push(...history.filter((m) => m.role !== 'system'));
  return messages;
}

async function fetchExternalData(
  intent: IntentResult,
): Promise<{ injection: string; sources: string[]; data?: WeatherData | CountryData }> {
  if (intent.type === 'weather' && intent.entity) {
    try {
      const weather = await getWeather(intent.entity);
      return {
        data: weather,
        sources: ['OpenWeatherMap'],
        injection:
          `[Live Data — OpenWeatherMap]\n` +
          `City: ${weather.city}, ${weather.country}\n` +
          `Temperature: ${weather.temperature}°C (feels like ${weather.feelsLike}°C)\n` +
          `Conditions: ${weather.description}\n` +
          `Humidity: ${weather.humidity}% | Wind: ${weather.windSpeed} m/s\n` +
          `Use this real-time data to inform your response.`,
      };
    } catch (err) {
      console.warn('[weather] fetch failed:', err instanceof Error ? err.message : err);
      return { injection: `[Note] Could not fetch live weather for "${intent.entity}". Use general knowledge.`, sources: [] };
    }
  }

  if (intent.type === 'country_info' && intent.entity) {
    try {
      const country = await getCountryInfo(intent.entity);
      return {
        data: country,
        sources: ['RestCountries'],
        injection:
          `[Live Data — RestCountries]\n` +
          `Country: ${country.name} (${country.region})\n` +
          `Capital: ${country.capital}\n` +
          `Currency: ${country.currencies.join(', ')}\n` +
          `Languages: ${country.languages.join(', ')}\n` +
          `Population: ${country.population.toLocaleString()}\n` +
          `Use this data to ground your response.`,
      };
    } catch (err) {
      console.warn('[countries] fetch failed:', err instanceof Error ? err.message : err);
      return { injection: `[Note] Could not fetch country info for "${intent.entity}". Use general knowledge.`, sources: [] };
    }
  }

  return { injection: '', sources: [] };
}

export async function runPipeline(history: Message[], userMessage: string): Promise<PipelineResult> {
  const provider = getLLMProvider();
  const sources: string[] = ['Claude'];

  // ── Stage 1: Intent classification ──────────────────────────────────────
  let intent = classifyIntent(userMessage);
  console.log(`[intent] ${intent.type}${intent.entity ? ` → "${intent.entity}"` : ''}`);

  // Start intent supervisor async while data fetch runs in parallel
  const needsSupervisor = SUPERVISED_INTENTS.has(intent.type);
  const intentCheckPromise = runIntentSupervisor(userMessage, intent);

  // ── Stage 2: Data fetch ──────────────────────────────────────────────────
  let { injection, sources: apiSources, data: fetchedData } = await fetchExternalData(intent);
  sources.push(...apiSources);

  // Await intent supervisor — should be done by now (ran during data fetch)
  const intentResult = await intentCheckPromise;
  console.log(`[intent-supervisor] ${intentResult.verdict}${intentResult.feedback ? `: ${intentResult.feedback}` : ''}`);

  if (intentResult.verdict === 'REFINE') {
    // Supervisor flagged wrong intent — log and re-classify
    // Note: classifyIntent is rule-based so we log the correction for visibility
    console.warn(`[intent] supervisor correction: ${intentResult.feedback}`);
    intent = classifyIntent(userMessage);
    const refetch = await fetchExternalData(intent);
    injection = refetch.injection;
    sources.length = 1; // reset to ['Claude']
    sources.push(...refetch.sources);
    fetchedData = refetch.data;
    console.log(`[intent] retried → ${intent.type}${intent.entity ? ` → "${intent.entity}"` : ''}`);
  }

  // ── Data supervisor (only when external data was fetched) ────────────────
  if (fetchedData && (intent.type === 'weather' || intent.type === 'country_info')) {
    const dataResult = await runDataSupervisor(userMessage, fetchedData, intent.type);
    console.log(`[data-supervisor] ${dataResult.verdict}${dataResult.feedback ? `: ${dataResult.feedback}` : ''}`);

    if (dataResult.verdict === 'REFINE') {
      // Drop external data, fall back to LLM knowledge
      console.warn('[data-supervisor] dropping external data, falling back to LLM');
      injection = `[Note] External data was fetched but may not match the query. Use your general knowledge instead. ${dataResult.feedback ?? ''}`;
      sources.length = 1; // reset to ['Claude']
    }
  }

  // ── Stage 3: Travel Agent ────────────────────────────────────────────────
  const messages = buildMessages(intent, history, injection || undefined);
  let reply = await provider.chat(messages);

  // ── Response supervisor (only on risky intents) ──────────────────────────
  if (needsSupervisor) {
    const responseResult = await runResponseSupervisor(userMessage, reply);
    console.log(`[response-supervisor] ${responseResult.verdict}${responseResult.feedback ? `: ${responseResult.feedback}` : ''}`);

    if (responseResult.verdict === 'REFINE') {
      // Retry Travel Agent with corrective guidance injected
      const correctedMessages = buildMessages(intent, history, injection || undefined);
      correctedMessages.push({
        role: 'user',
        content: `[Quality review found an issue with your previous response: ${responseResult.feedback}. Please revise your answer addressing this concern.]`,
      });
      reply = await provider.chat(correctedMessages);
      console.log('[response-supervisor] retried travel agent');
    }
  }

  return { reply, sources };
}
