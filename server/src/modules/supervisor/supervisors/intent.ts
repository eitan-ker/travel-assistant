import Anthropic from '@anthropic-ai/sdk';
import { Verdict } from '../../../shared/enums.js';
import { runWithRetry, type SupervisorResult } from '../types.js';
import { isSupervisorToolInput, parseVerdict } from '../guards.js';

const PREFLIGHT_INTENT_PROMPT = `You are a pre-flight check for a travel assistant. Your job is to decide whether there is enough context to run expensive API tools before the travel agent responds.

Verdicts:
- PASS: enough context to run tools — destination is known and unambiguous, or query clearly needs live data (weather, attractions, country info)
- REFINE: intent is clear but missing key info (no destination, no preferences) — let the agent ask clarifying questions without firing tools
- CLARIFY: destination or key intent is genuinely ambiguous between equally likely options — ask the user directly before doing anything. You MUST provide a specific question that names the ambiguous options. Never return a generic question.

Examples:
- "hello" → PASS (no tools needed, agent handles it)
- "find me a destination" → REFINE (clear intent, but zero preferences to work with)
- "beach vacation 10K ILS August" → PASS (enough to run think_destination_recommendation)
- "beach & relaxation" → PASS (travel style is enough to run think_destination_recommendation)
- "culture and food" → PASS (interests are enough to start recommendations)
- "what is the weather in Paris?" → CLARIFY (Paris is ambiguous — France or Texas?)
- "I want to go to Tokyo" → PASS (clear destination, tools should run)
- "plan a trip" → REFINE (intent clear, destination and preferences unknown)

Key rule: if the user has provided ANY travel style, interests, or preferences — even without budget or dates — that is enough to run think_destination_recommendation. PASS.

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
