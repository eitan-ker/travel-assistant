import Anthropic from '@anthropic-ai/sdk';
import { runWithRetry, type SupervisorResult } from './types.js';
import { INTENT_SUPERVISOR_PROMPT } from '../../prompts/intentSupervisor.js';

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

async function call(userMessage: string, toolsUsed: string[]): Promise<SupervisorResult> {
  const toolsSummary = toolsUsed.length > 0
    ? `Tools called: ${toolsUsed.join(', ')}`
    : 'No tools were called — Claude answered from its own knowledge';

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    system: INTENT_SUPERVISOR_PROMPT,
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
  return runWithRetry('intent-supervisor', () => call(userMessage, toolsUsed));
}
