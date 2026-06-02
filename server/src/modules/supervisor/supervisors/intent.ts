import Anthropic from '@anthropic-ai/sdk';
import { DATA_SUPERVISOR_MAX_TOKENS, PREFLIGHT_SUPERVISOR_MAX_TOKENS, RESPONSE_SUPERVISOR_MAX_TOKENS, COMPACTION_SUMMARY_MAX_TOKENS } from '../../../shared/constants.js';
import { Verdict } from '../../../shared/enums.js';
import { runWithRetry, type SupervisorResult } from '../types.js';
import { isSupervisorToolInput, parseVerdict } from '../guards.js';

const PREFLIGHT_INTENT_PROMPT = `You are a pre-flight check for a travel assistant. Your default is PASS. CLARIFY is rare.

CLARIFY only when the user has written a name that is equally shared by multiple famous real-world places — and you truly cannot determine which one they mean without asking.

PASS always when:
- The name refers to one clear, real location (even if small or unfamiliar)
- The user is answering a question the agent asked
- Context or information is missing but the intent is clear
- You are unsure — default to PASS

CLARIFY is NOT for: incomplete answers, short responses, ambiguous intent, or unusual place names. Only for genuine name collision between equally famous places.

Call preflight_check with your verdict. You MUST always provide reasoning.`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'preflight_check',
  description: 'Submit your verdict on whether there is enough context to run tools.',
  input_schema: {
    type: 'object' as const,
    properties: {
      verdict: {
        type: 'string',
        enum: [Verdict.Pass, Verdict.Clarify],
        description: 'PASS to proceed — agent handles everything. CLARIFY only when destination or intent is genuinely ambiguous between equally likely options.',
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
