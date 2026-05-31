import Anthropic from '@anthropic-ai/sdk';
import { runWithRetry, type SupervisorResult } from './types.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'review_response',
  description: 'Submit your quality verdict on the travel assistant response.',
  input_schema: {
    type: 'object' as const,
    properties: {
      verdict: {
        type: 'string',
        enum: ['PASS', 'REFINE'],
        description: 'PASS if response is good quality. REFINE if it has issues.',
      },
      reasoning: {
        type: 'string',
        description: 'Always required. Explain why you gave this verdict.',
      },
      feedback: {
        type: 'string',
        description: 'Required when verdict is REFINE. Be specific about what to fix.',
      },
    },
    required: ['verdict', 'reasoning'],
  },
};

async function callResponseSupervisor(
  userMessage: string,
  response: string,
  priorContext?: string,
  verifiedSources?: string[],
): Promise<SupervisorResult> {
  const sourceNote = verifiedSources && verifiedSources.length > 0
    ? `\n\nVERIFIED LIVE DATA: This response includes real-time data fetched from: ${verifiedSources.join(', ')}. Any specific numbers, conditions, or facts from these sources are REAL verified data — do NOT flag them as hallucinations.`
    : '';

  const result = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    system: `You are a response quality reviewer for a travel assistant. You do NOT answer travel questions.
You only review responses for these specific issues:

1. HALLUCINATED FACTS: specific prices ("$150 flights"), specific visa claims, specific hotel/restaurant names stated as fact
2. OFF-TOPIC: response doesn't address what the user asked
3. TOO VERBOSE: response is over 250 words without the user asking for detail
4. UNANSWERED: response asks a clarifying question without attempting to answer at all

If NONE of these issues are present → PASS.
If ANY issue is present → REFINE with specific feedback on what to fix.

Be strict about hallucinated prices and visa claims. Be lenient on everything else.
Call review_response with your verdict. You MUST always provide reasoning.${sourceNote}`,
    messages: [
      {
        role: 'user',
        content: `${priorContext ? `Prior conversation context:\n${priorContext}\n\n` : ''}User asked: "${userMessage}"\n\nAssistant responded:\n"${response}"\n\nReview this response.`,
      },
    ],
  });

  const toolUse = result.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return { verdict: 'PASS', reasoning: 'No tool use response' };

  const input = toolUse.input as { verdict: string; reasoning?: string; feedback?: string };
  return { verdict: input.verdict as 'PASS' | 'REFINE', reasoning: input.reasoning ?? '', feedback: input.feedback };
}

export function runResponseSupervisor(
  userMessage: string,
  response: string,
  priorContext?: string,
  verifiedSources?: string[],
): Promise<SupervisorResult> {
  return runWithRetry('response-supervisor', () => callResponseSupervisor(userMessage, response, priorContext, verifiedSources));
}
