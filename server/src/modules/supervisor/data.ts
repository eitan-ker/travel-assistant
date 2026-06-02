import Anthropic from '@anthropic-ai/sdk';
import type { WeatherData } from '../integrations/weather.js';
import type { CountryData } from '../integrations/countries.js';
import { runWithRetry, type SupervisorResult, type Verdict } from './types.js';
import { DATA_SUPERVISOR_PROMPT } from '../../prompts/dataSupervisor.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'review_data',
  description: 'Submit your verdict on whether the fetched external data matches the user query.',
  input_schema: {
    type: 'object' as const,
    properties: {
      verdict: {
        type: 'string',
        enum: ['PASS', 'REFINE', 'CLARIFY'],
        description: 'PASS if data matches. REFINE if clearly wrong but obvious fix. CLARIFY if the user query is ambiguous and you need them to specify (e.g. which city they meant).',
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
        description: 'Required when verdict is CLARIFY. Short, direct question to ask the user. Example: "Did you mean Netanya, Israel or Netanya, Illinois?"',
      },
    },
    required: ['verdict', 'reasoning'],
  },
};

async function call(
  userMessage: string,
  data: WeatherData | CountryData | string,
  dataType: 'weather' | 'country_info' | 'attractions',
): Promise<SupervisorResult> {
  const dataDescription = typeof data === 'string'
    ? data
    : dataType === 'weather'
      ? `Weather data fetched for: ${(data as WeatherData).city} (ISO country code: ${(data as WeatherData).country})`
      : `Country data fetched for: ${(data as CountryData).name} (${(data as CountryData).region})`;

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
  if (!toolUse || toolUse.type !== 'tool_use') return { verdict: 'PASS', reasoning: 'No tool use response' };

  const input = toolUse.input as { verdict: string; reasoning?: string; feedback?: string; question?: string };
  return { verdict: input.verdict as Verdict, reasoning: input.reasoning ?? '', feedback: input.feedback, question: input.question };
}

export function runDataSupervisor(
  userMessage: string,
  data: WeatherData | CountryData | string,
  dataType: 'weather' | 'country_info' | 'attractions',
): Promise<SupervisorResult> {
  return runWithRetry('data-supervisor', () => call(userMessage, data, dataType));
}
