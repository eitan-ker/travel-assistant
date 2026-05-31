import Anthropic from '@anthropic-ai/sdk';
import { runWithRetry, type SupervisorResult } from './types.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'review_tool_selection',
  description: 'Submit your verdict on whether Claude selected the right tools for this query.',
  input_schema: {
    type: 'object' as const,
    properties: {
      verdict: {
        type: 'string',
        enum: ['PASS', 'REFINE'],
        description: 'PASS if tool selection was appropriate. REFINE if wrong or missing tools.',
      },
      reasoning: {
        type: 'string',
        description: 'Always required. Explain why the tool selection was right or wrong.',
      },
      feedback: {
        type: 'string',
        description: 'Required on REFINE. What tools should have been called instead.',
      },
    },
    required: ['verdict', 'reasoning'],
  },
};

async function callIntentSupervisor(userMessage: string, toolsUsed: string[]): Promise<SupervisorResult> {
  const toolsSummary = toolsUsed.length > 0
    ? `Tools called: ${toolsUsed.join(', ')}`
    : 'No tools were called — Claude answered from its own knowledge';

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    system: `You are a tool selection auditor for a travel assistant.
Your only job is to check if Claude called the right tools for the user's query.

Available tools:
- get_weather(city): live weather — use when user specifies a time window (month, season, "right now", "this week", "in June")
- get_country_info(country): factual data — capital, currency, language
- get_attractions(city): top POIs — what to see/do in a city
- think_destination_recommendation: reasoning tool — for destination suggestions when no destination is given
- think_packing_advice: reasoning tool — for packing questions
- think_local_attractions: reasoning tool — for local things to do
- think_trip_plan: reasoning tool — for full trip planning when destination, origin, duration and budget are known. Must be accompanied by get_weather, get_country_info, get_attractions.

Important rules:
- get_weather is only needed when the user gives a specific time context. If no time is specified, Claude's general climate knowledge is sufficient.
- think_packing_advice should be called for any packing question.
- think_destination_recommendation should be called for destination suggestions.
- think_local_attractions should be called for "what to do/see" questions.
- think_trip_plan should be called when user wants a full trip plan and has given destination + origin + duration.

Call review_tool_selection with your verdict. You MUST always provide reasoning.`,
    messages: [
      {
        role: 'user',
        content: `User asked: "${userMessage}"\n${toolsSummary}\n\nWas this the right tool selection?`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return { verdict: 'PASS', reasoning: 'No tool use response' };

  const input = toolUse.input as { verdict: string; reasoning?: string; feedback?: string };
  return { verdict: input.verdict as 'PASS' | 'REFINE', reasoning: input.reasoning ?? '', feedback: input.feedback };
}

export function runIntentSupervisor(userMessage: string, toolsUsed: string[]): Promise<SupervisorResult> {
  return runWithRetry('intent-supervisor', () => callIntentSupervisor(userMessage, toolsUsed));
}
