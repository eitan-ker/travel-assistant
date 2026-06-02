import Anthropic from '@anthropic-ai/sdk';
import { DATA_SUPERVISOR_MAX_TOKENS, PREFLIGHT_SUPERVISOR_MAX_TOKENS, RESPONSE_SUPERVISOR_MAX_TOKENS, COMPACTION_SUMMARY_MAX_TOKENS } from '../../../shared/constants.js';
import { Verdict } from '../../../shared/enums.js';
import { runWithRetry, type SupervisorResult } from '../types.js';
import { isSupervisorToolInput, parseVerdict } from '../guards.js';

const PREFLIGHT_INTENT_PROMPT = `You are a pre-flight check for a travel assistant. Your default is PASS. CLARIFY is rare.

Reason in this exact order:

STEP 1 — Is the user answering the agent's question?
Look at the "Last assistant message" in the session context. If it asked the user anything (origin, passport, budget, interests, dates, travel style, etc.), then the user's message is an ANSWER to that question. PASS immediately. Do not evaluate it as a new destination or check for ambiguity. A nationality, a number, a city, a one-word reply — these are answers, not destination changes.

STEP 2 — Only if the message is a genuinely NEW query (not an answer):
CLARIFY only when the user named a place that is equally shared by multiple famous real-world locations and you truly cannot tell which one they mean. Everything else PASS.
When you CLARIFY, the question field is REQUIRED and MUST name the specific competing options so the user can pick one. Never return CLARIFY with an empty or generic question.

Never CLARIFY for: answers to the agent's questions, incomplete info, short replies, or a single clear location. When unsure, PASS.

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
