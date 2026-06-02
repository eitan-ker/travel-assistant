import Anthropic from '@anthropic-ai/sdk';
import { DATA_SUPERVISOR_MAX_TOKENS, PREFLIGHT_SUPERVISOR_MAX_TOKENS, RESPONSE_SUPERVISOR_MAX_TOKENS, COMPACTION_SUMMARY_MAX_TOKENS } from '../../shared/constants.js';
import { Role } from '../../shared/enums.js';
import { COMPACTION_PROMPT } from '../../prompts/compaction.js';
import type { Message } from '../../shared/types.js';

import { COMPACTION_THRESHOLD_CHARS } from '../../shared/constants.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ConversationSummary {
  tripGoal: string;
  userProfile: string;
  conversationSummary: string;
  decisions: string;
  pendingQuestions: string;
}

function formatSummary(summary: ConversationSummary): string {
  const parts = [
    summary.tripGoal && `Trip goal: ${summary.tripGoal}`,
    summary.userProfile && `User profile: ${summary.userProfile}`,
    summary.conversationSummary && `Discussion: ${summary.conversationSummary}`,
    summary.decisions && `Decisions made: ${summary.decisions}`,
    summary.pendingQuestions && `Pending: ${summary.pendingQuestions}`,
  ].filter(Boolean);

  return `[CONVERSATION CONTEXT]\n${parts.join('\n')}`;
}

export function shouldCompact(messages: Message[]): boolean {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return totalChars > COMPACTION_THRESHOLD_CHARS;
}

export async function compactHistory(messages: Message[]): Promise<Message[]> {
  if (!messages.length) return messages;

  const historyText = messages
    .filter((m) => m.role !== Role.System)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n');

  try {
    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: COMPACTION_PROMPT,
      messages: [{ role: 'user', content: historyText }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return messages;

    const summary = JSON.parse(textBlock.text) as ConversationSummary;
    const compacted = formatSummary(summary);

    console.log(`[compaction] reduced ${messages.length} messages to 1 summary block`);

    return [{ role: Role.System, content: compacted }];
  } catch (err) {
    console.warn('[compaction] failed — keeping original history', err);
    return messages;
  }
}
