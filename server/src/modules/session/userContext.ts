import Anthropic from '@anthropic-ai/sdk';
import { DATA_SUPERVISOR_MAX_TOKENS, PREFLIGHT_SUPERVISOR_MAX_TOKENS, RESPONSE_SUPERVISOR_MAX_TOKENS, COMPACTION_SUMMARY_MAX_TOKENS } from '../../shared/constants.js';
import type { UserContext } from './types.js';

const USER_CONTEXT_PROMPT = `Extract any new information from the user's message about themselves or their trip. Only extract what is explicitly stated — do not infer or guess. If nothing new is revealed, do not call the tool.

Critical rule: use the last assistant message to understand what was being asked. If the assistant asked "where are you flying from?" and the user answered with a place name, extract it as origin — NOT destination. If the assistant asked about budget and the user answered with a number, extract it as budget. Always interpret the user's answer in the context of the question that was asked.

Key fields to watch for:
- destination: the target location — the place being traveled to, packed for, explored, or asked about. Extract from any travel-related query regardless of how it's phrased (packing questions, weather questions, attraction questions, trip planning). Update when a new target location is mentioned.
- origin: the source location — where the traveler is coming from, flying from, or calls home. This is a constraint on the trip (affects flights, visa, cost), not the travel target.
- passport: their passport nationalities — they may hold multiple passports, always collect all mentioned
- interests: travel interests or activities mentioned (beach, culture, food, nightlife, hiking, relaxation, etc.)
- travelStyle: how they travel — solo, couple, family, backpacker, luxury, etc.
- budget: any budget amount or level mentioned
- tripDuration: how long the trip is
- travelerConstraints: accessibility needs, dietary requirements, or any personal travel limitations — only extract if a real constraint is stated. If the user says "none", "no", "nothing", "no constraints", do NOT extract anything for this field.`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOL: Anthropic.Tool = {
  name: 'extract_user_context',
  description: 'Extract profile information the user has revealed about themselves or their trip.',
  input_schema: {
    type: 'object' as const,
    properties: {
      destination: { type: 'string', description: 'The target location — where they are traveling to, packing for, exploring, or asking about. Extract from any travel query regardless of phrasing.' },
      origin: { type: 'string', description: 'The source location — where they are flying from or their home base. A trip constraint, not the travel target.' },
      passport: {
        type: 'array',
        items: { type: 'string' },
        description: 'All passport nationalities mentioned — a traveler may hold multiple passports (e.g. ["Israeli", "American"]). Always collect all mentioned.',
      },
      interests: {
        type: 'array',
        items: { type: 'string' },
        description: 'Travel interests explicitly mentioned (food, nightlife, culture, adventure, beach, etc.)',
      },
      budget: { type: 'string', description: 'Budget mentioned (e.g. "$5,000", "mid-range", "budget traveler")' },
      travelStyle: { type: 'string', description: 'How they travel — solo, couple, family, backpacker, luxury, etc.' },
      tripDuration: { type: 'string', description: 'How long the trip is (e.g. "2 weeks", "10 days")' },
      travelGroup: { type: 'string', description: 'Who they are traveling with — solo, partner, family, friends' },
      travelerConstraints: { type: 'string', description: 'Any personal constraints that affect travel — accessibility needs, dietary requirements, medical considerations' },
      notes: { type: 'string', description: 'Any other relevant context about this traveler' },
    },
    required: [],
  },
};

export async function extractUserContext(userMessage: string, existing: UserContext, lastAssistantMessage?: string): Promise<UserContext> {
  const contextNote = lastAssistantMessage
    ? `\nLast assistant question: "${lastAssistantMessage.slice(0, 300)}"\n`
    : '';

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    system: USER_CONTEXT_PROMPT,
    messages: [
      {
        role: 'user',
        content: `${contextNote}User message: "${userMessage}"\n\nExtract any profile information they revealed.`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return existing;

  const raw = toolUse.input;
  if (typeof raw !== 'object' || raw === null) return existing;
  const extracted = raw as Partial<UserContext>;

  const NEGATION_VALUES = new Set(['none', 'no', 'n/a', 'nothing', 'no constraints', 'no restrictions']);
  const isNegation = (v: string | undefined) => v && NEGATION_VALUES.has(v.toLowerCase().trim());

  return {
    destination: extracted.destination ?? existing.destination,
    origin: extracted.origin ?? existing.origin,
    passport: extracted.passport?.length
      ? [...new Set([...(existing.passport ?? []), ...extracted.passport])]
      : existing.passport,
    interests: extracted.interests?.length ? extracted.interests : existing.interests,
    budget: extracted.budget ?? existing.budget,
    travelStyle: extracted.travelStyle ?? existing.travelStyle,
    tripDuration: extracted.tripDuration ?? existing.tripDuration,
    travelGroup: extracted.travelGroup ?? existing.travelGroup,
    travelerConstraints: isNegation(extracted.travelerConstraints) ? undefined : (extracted.travelerConstraints ?? existing.travelerConstraints),
    notes: extracted.notes ?? existing.notes,
  };
}

export function formatUserContext(ctx: UserContext): string | null {
  const lines: string[] = [];
  if (ctx.destination) lines.push(`Destination: ${ctx.destination}`);
  if (ctx.origin) lines.push(`From: ${ctx.origin}`);
  if (ctx.passport?.length) lines.push(`Passport(s): ${ctx.passport.join(', ')}`);
  if (ctx.interests?.length) lines.push(`Interests: ${ctx.interests.join(', ')}`);
  if (ctx.budget) lines.push(`Budget: ${ctx.budget}`);
  if (ctx.travelStyle) lines.push(`Travel style: ${ctx.travelStyle}`);
  if (ctx.tripDuration) lines.push(`Trip length: ${ctx.tripDuration}`);
  if (ctx.travelGroup) lines.push(`Traveling: ${ctx.travelGroup}`);
  if (ctx.travelerConstraints) lines.push(`Constraints: ${ctx.travelerConstraints}`);
  if (ctx.notes) lines.push(`Notes: ${ctx.notes}`);
  return lines.length > 0 ? lines.join('\n') : null;
}
