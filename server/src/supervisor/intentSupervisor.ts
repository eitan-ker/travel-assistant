import Anthropic from '@anthropic-ai/sdk';
import type { IntentResult } from '../intent/router.js';
import type { SupervisorResult } from './types.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'review_intent',
  description: 'Submit your verdict on whether the intent classification is correct.',
  input_schema: {
    type: 'object' as const,
    properties: {
      verdict: {
        type: 'string',
        enum: ['PASS', 'REFINE'],
        description: 'PASS if intent and entity are correct. REFINE if something is wrong.',
      },
      reasoning: {
        type: 'string',
        description: 'Always required. Explain why you gave this verdict.',
      },
      feedback: {
        type: 'string',
        description: 'Required when verdict is REFINE. Explain what is wrong and what the correct intent/entity should be.',
      },
    },
    required: ['verdict', 'reasoning'],
  },
};

export async function runIntentSupervisor(
  userMessage: string,
  intent: IntentResult,
): Promise<SupervisorResult> {
  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    system: `You are an intent classification validator for a travel assistant.
Your only job is to check if the intent classification is correct for the user's message.

Intent types:
- weather: user wants current weather for a specific city
- country_info: user wants general info about a country
- destination_rec: user wants destination recommendations
- packing: user wants packing advice
- attractions: user wants things to do/see in a place
- general: anything else travel-related

Call review_intent with your verdict.`,
    messages: [
      {
        role: 'user',
        content: `User message: "${userMessage}"
Classified intent: ${intent.type}${intent.entity ? ` with entity "${intent.entity}"` : ''}

Is this classification correct?`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return { verdict: 'PASS', reasoning: 'No tool use response' };

  const input = toolUse.input as { verdict: string; reasoning: string; feedback?: string };
  console.log(`[intent-supervisor] reasoning: ${input.reasoning}`);
  return { verdict: input.verdict as 'PASS' | 'REFINE', reasoning: input.reasoning, feedback: input.feedback };
}
