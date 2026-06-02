import Anthropic from '@anthropic-ai/sdk';
import { Verdict } from '../../../shared/enums.js';
import { runWithRetry, type SupervisorResult } from '../types.js';
import { isSupervisorToolInput, parseVerdict } from '../guards.js';
const RESPONSE_SUPERVISOR_PROMPT = `You are a response quality reviewer for a travel assistant. You do NOT answer travel questions.
You only review responses for these specific issues:

1. HALLUCINATED FACTS: specific prices ("$150 flights"), specific visa claims, specific hotel/restaurant names stated as fact
2. OFF-TOPIC: response doesn't address what the user asked
3. TOO VERBOSE: response is over 400 words without the user asking for detail
4. UNANSWERED: response asks a clarifying question without attempting ANY useful answer or context

Important: asking clarifying questions before recommending destinations is CORRECT behavior — do NOT flag it as UNANSWERED if the assistant is gathering necessary information (destination preferences, budget, duration, travel style) before making recommendations. This is good travel assistant practice.

Important: <cite> tags in the response are real web search citations — do NOT flag them as hallucinations or formatting issues. They are verified live data.

Any value explicitly labeled as an estimate — with phrases like "estimated", "approximate", "verify before booking", or "based on general knowledge" — is intentional and correct. Do NOT flag labeled estimates as hallucinations regardless of what they refer to. Only flag values that are stated as verified facts without any qualification.

If NONE of these issues are present → PASS.
If ANY issue is present → REFINE with specific feedback on what to fix.

Call review_response with your verdict. You MUST always provide reasoning.`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'review_response',
  description: 'Submit your quality verdict on the travel assistant response.',
  input_schema: {
    type: 'object' as const,
    properties: {
      verdict: {
        type: 'string',
        enum: [Verdict.Pass, Verdict.Refine],
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


async function call(
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
    max_tokens: 512,
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    system: RESPONSE_SUPERVISOR_PROMPT + sourceNote,
    messages: [
      {
        role: 'user',
        content: `${priorContext ? `Prior conversation context:\n${priorContext}\n\n` : ''}User asked: "${userMessage}"\n\nAssistant responded:\n"${response}"\n\nReview this response.`,
      },
    ],
  });

  const toolUse = result.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return { verdict: Verdict.Pass, reasoning: 'No tool use response' };

  if (!isSupervisorToolInput(toolUse.input)) return { verdict: Verdict.Pass, reasoning: 'Unexpected tool input shape' };

  return {
    verdict: parseVerdict(toolUse.input.verdict),
    reasoning: toolUse.input.reasoning ?? '',
    feedback: toolUse.input.feedback,
  };
}

export function runResponseSupervisor(
  userMessage: string,
  response: string,
  priorContext?: string,
  verifiedSources?: string[],
): Promise<SupervisorResult> {
  return runWithRetry('response-supervisor', () => call(userMessage, response, priorContext, verifiedSources));
}
