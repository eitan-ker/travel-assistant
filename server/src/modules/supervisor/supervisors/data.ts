import Anthropic from '@anthropic-ai/sdk';
import { Verdict, DataType } from '../../../shared/enums.js';
import type { WeatherData } from '../../api/apis/weather.js';
import type { CountryData } from '../../api/apis/countries.js';
import { runWithRetry, type SupervisorResult } from '../types.js';
import { isSupervisorToolInput, parseVerdict } from '../guards.js';
const DATA_SUPERVISOR_PROMPT = `You are a data relevance validator for a travel assistant.
Your only job is to check if the external data fetched actually matches what the user asked for.
Common failure: wrong city fetched or irrelevant country returned.
IMPORTANT: Country codes in weather API responses are ISO 3166-1 alpha-2 codes — not US state abbreviations. Do not confuse them.

Verdicts:
- PASS: data matches what the user asked for
- REFINE: wrong data was fetched but the correct entity is obvious from context or general knowledge — reject the data without asking the user. Use REFINE when a sub-city or regional city was fetched within a country that is already clear from context — the country resolves the ambiguity, no need to ask the user.
- CLARIFY: ONLY use when the top-level destination country or region itself is genuinely ambiguous. Do NOT use CLARIFY for sub-city ambiguity within a country that is already clear from context.

Call review_data with your verdict. You MUST always provide reasoning.`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'review_data',
  description: 'Submit your verdict on whether the fetched external data matches the user query.',
  input_schema: {
    type: 'object' as const,
    properties: {
      verdict: {
        type: 'string',
        enum: [Verdict.Pass, Verdict.Refine, Verdict.Clarify],
        description: 'PASS if data matches. REFINE if clearly wrong but obvious fix. CLARIFY if the user query is ambiguous and you need them to specify.',
      },
      reasoning: {
        type: 'string',
        description: 'Always required. Explain why you gave this verdict.',
      },
      feedback: {
        type: 'string',
        description: 'Required when verdict is REFINE. Explain what is wrong and what should be fetched instead.',
      },
      question: {
        type: 'string',
        description: 'Required when verdict is CLARIFY. Short, direct question to ask the user.',
      },
    },
    required: ['verdict', 'reasoning'],
  },
};


function buildDataDescription(data: WeatherData | CountryData | string, dataType: DataType): string {
  if (typeof data === 'string') return data;
  if (dataType === DataType.Weather) {
    const w = data as WeatherData;
    return `Weather data fetched for: ${w.city} (ISO country code: ${w.country})`;
  }
  const c = data as CountryData;
  return `Country data fetched for: ${c.name} (${c.region})`;
}

async function call(
  userMessage: string,
  data: WeatherData | CountryData | string,
  dataType: DataType,
): Promise<SupervisorResult> {
  const dataDescription = buildDataDescription(data, dataType);

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    system: DATA_SUPERVISOR_PROMPT,
    messages: [
      {
        role: 'user',
        content: `User message: "${userMessage}"\n${dataDescription}\n\nIs this the correct data for the user's query?`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return { verdict: Verdict.Pass, reasoning: 'No tool use response' };

  if (!isSupervisorToolInput(toolUse.input)) return { verdict: Verdict.Pass, reasoning: 'Unexpected tool input shape' };

  return {
    verdict: parseVerdict(toolUse.input.verdict),
    reasoning: toolUse.input.reasoning ?? '',
    feedback: toolUse.input.feedback,
    question: toolUse.input.question,
  };
}

export function runDataSupervisor(
  userMessage: string,
  data: WeatherData | CountryData | string,
  dataType: DataType,
): Promise<SupervisorResult> {
  return runWithRetry('data-supervisor', () => call(userMessage, data, dataType));
}
