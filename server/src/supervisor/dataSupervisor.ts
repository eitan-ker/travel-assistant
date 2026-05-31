import Anthropic from '@anthropic-ai/sdk';
import type { WeatherData } from '../apis/weather.js';
import type { CountryData } from '../apis/countries.js';
import { runWithRetry, type SupervisorResult } from './types.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'review_data',
  description: 'Submit your verdict on whether the fetched external data matches the user query.',
  input_schema: {
    type: 'object' as const,
    properties: {
      verdict: {
        type: 'string',
        enum: ['PASS', 'REFINE'],
        description: 'PASS if data is relevant and correctly matched. REFINE if wrong entity was fetched or data is irrelevant.',
      },
      reasoning: {
        type: 'string',
        description: 'Always required. Explain why you gave this verdict.',
      },
      feedback: {
        type: 'string',
        description: 'Required when verdict is REFINE. Explain what is wrong and what should be fetched instead.',
      },
    },
    required: ['verdict', 'reasoning'],
  },
};

async function callDataSupervisor(
  userMessage: string,
  data: WeatherData | CountryData | string,
  dataType: 'weather' | 'country_info' | 'attractions',
): Promise<SupervisorResult> {
  const dataDescription = typeof data === 'string'
    ? data
    : dataType === 'weather'
      ? `Weather data fetched for: ${(data as WeatherData).city}, ${(data as WeatherData).country}`
      : `Country data fetched for: ${(data as CountryData).name} (${(data as CountryData).region})`;

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    system: `You are a data relevance validator for a travel assistant.
Your only job is to check if the external data fetched actually matches what the user asked for.
Common failure: wrong city fetched (e.g. "Paris, Texas" instead of "Paris, France"), or irrelevant country returned.
Call review_data with your verdict. You MUST always provide reasoning.`,
    messages: [
      {
        role: 'user',
        content: `User message: "${userMessage}"\n${dataDescription}\n\nIs this the correct data for the user's query?`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return { verdict: 'PASS', reasoning: 'No tool use response' };

  const input = toolUse.input as { verdict: string; reasoning?: string; feedback?: string };
  return { verdict: input.verdict as 'PASS' | 'REFINE', reasoning: input.reasoning ?? '', feedback: input.feedback };
}

export function runDataSupervisor(
  userMessage: string,
  data: WeatherData | CountryData | string,
  dataType: 'weather' | 'country_info' | 'attractions',
): Promise<SupervisorResult> {
  return runWithRetry('data-supervisor', () => callDataSupervisor(userMessage, data, dataType));
}
