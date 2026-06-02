import Anthropic from '@anthropic-ai/sdk';
import { Verdict } from '../../../shared/enums.js';
import { runWithRetry, type SupervisorResult } from '../types.js';
import { isSupervisorToolInput, parseVerdict } from '../guards.js';
import { PREFLIGHT_INTENT_PROMPT } from '../../../prompts/intentSupervisor.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'preflight_check',
  description: 'Submit your verdict on whether there is enough context to run tools.',
  input_schema: {
    type: 'object' as const,
    properties: {
      verdict: {
        type: 'string',
        enum: [Verdict.Pass, Verdict.Refine, Verdict.Clarify],
        description: 'PASS if enough context to run tools. REFINE if intent is clear but more info needed — run agent without tools. CLARIFY if destination or key intent is genuinely ambiguous — ask user directly.',
      },
      reasoning: {
        type: 'string',
        description: 'Always required.',
      },
      question: {
        type: 'string',
        description: 'Required on CLARIFY. A short, specific question that resolves the ambiguity — must name the specific options.',
      },
    },
    required: ['verdict', 'reasoning'],
  },
};

async function call(userMessage: string, sessionContext?: string): Promise<SupervisorResult> {
  const contextBlock = sessionContext
    ? `\nSession context (already known):\n${sessionContext}\n`
    : '';

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    system: PREFLIGHT_INTENT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `User message: "${userMessage}"${contextBlock}\n\nShould we run tools for this query?`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return { verdict: Verdict.Pass, reasoning: 'No tool use response' };
  if (!isSupervisorToolInput(toolUse.input)) return { verdict: Verdict.Pass, reasoning: 'Unexpected tool input shape' };

  return {
    verdict: parseVerdict(toolUse.input.verdict),
    reasoning: toolUse.input.reasoning ?? '',
    question: toolUse.input.question,
  };
}

export function runPreflightSupervisor(userMessage: string, sessionContext?: string): Promise<SupervisorResult> {
  return runWithRetry('preflight-supervisor', () => call(userMessage, sessionContext));
}
