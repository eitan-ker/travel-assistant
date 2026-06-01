import Anthropic from '@anthropic-ai/sdk';
import type { UserContext } from './types.js';
import { USER_CONTEXT_PROMPT } from '../../prompts/userContext.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'extract_user_context',
  description: 'Extract profile information the user has revealed about themselves.',
  input_schema: {
    type: 'object' as const,
    properties: {
      origin: { type: 'string', description: 'Where they are flying from or their home city/country' },
      interests: {
        type: 'array',
        items: { type: 'string' },
        description: 'Travel interests explicitly mentioned (food, nightlife, culture, adventure, beach, etc.)',
      },
      budget: { type: 'string', description: 'Budget mentioned (e.g. "$5,000", "mid-range", "budget traveler")' },
      travelStyle: { type: 'string', description: 'How they travel — solo, couple, family, backpacker, luxury, etc.' },
      tripDuration: { type: 'string', description: 'How long the trip is (e.g. "2 weeks", "10 days")' },
      travelGroup: { type: 'string', description: 'Who they are traveling with — solo, partner, family, friends' },
      notes: { type: 'string', description: 'Any other relevant context about this traveler' },
    },
    required: [],
  },
};

export async function extractUserContext(userMessage: string, existing: UserContext): Promise<UserContext> {
  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    system: USER_CONTEXT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `User message: "${userMessage}"\n\nExtract any profile information they revealed.`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return existing;

  const extracted = toolUse.input as Partial<UserContext>;

  return {
    origin: extracted.origin ?? existing.origin,
    interests: extracted.interests?.length ? extracted.interests : existing.interests,
    budget: extracted.budget ?? existing.budget,
    travelStyle: extracted.travelStyle ?? existing.travelStyle,
    tripDuration: extracted.tripDuration ?? existing.tripDuration,
    travelGroup: extracted.travelGroup ?? existing.travelGroup,
    notes: extracted.notes ?? existing.notes,
  };
}

export function formatUserContext(ctx: UserContext): string | null {
  const lines: string[] = [];
  if (ctx.origin) lines.push(`From: ${ctx.origin}`);
  if (ctx.interests?.length) lines.push(`Interests: ${ctx.interests.join(', ')}`);
  if (ctx.budget) lines.push(`Budget: ${ctx.budget}`);
  if (ctx.travelStyle) lines.push(`Travel style: ${ctx.travelStyle}`);
  if (ctx.tripDuration) lines.push(`Trip length: ${ctx.tripDuration}`);
  if (ctx.travelGroup) lines.push(`Traveling: ${ctx.travelGroup}`);
  if (ctx.notes) lines.push(`Notes: ${ctx.notes}`);
  return lines.length > 0 ? lines.join('\n') : null;
}
