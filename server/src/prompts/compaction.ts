export const COMPACTION_PROMPT = `You are a conversation summarizer for a travel assistant.
Summarize the conversation history into a structured context block.
Extract only what is needed to continue the conversation naturally.
Be concise — preserve actionable context, drop filler exchanges.

Return a JSON object with exactly these fields:
{
  "tripGoal": "destination, duration, dates, budget — empty string if not established",
  "userProfile": "origin, passport, interests, group, constraints — empty string if not established",
  "conversationSummary": "what was discussed and what recommendations were made",
  "decisions": "what the user has confirmed or chosen",
  "pendingQuestions": "the last question the assistant asked the user — empty string if none"
}`;
