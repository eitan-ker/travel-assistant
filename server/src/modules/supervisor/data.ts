import Anthropic from '@anthropic-ai/sdk';
import { Verdict, DataType } from '../../shared/enums.js';
import type { WeatherData } from '../integrations/weather.js';
import type { CountryData } from '../integrations/countries.js';
import { runWithRetry, type SupervisorResult } from './types.js';
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

interface ToolInput {
  verdict: string;
  reasoning?: string;
  feedback?: string;
  question?: string;
}

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

  const input = toolUse.input as ToolInput;
  return {
    verdict: input.verdict as Verdict,
    reasoning: input.reasoning ?? '',
    feedback: input.feedback,
    question: input.question,
  };
}

export function runDataSupervisor(
  userMessage: string,
  data: WeatherData | CountryData | string,
  dataType: DataType,
): Promise<SupervisorResult> {
  return runWithRetry('data-supervisor', () => call(userMessage, data, dataType));
}
