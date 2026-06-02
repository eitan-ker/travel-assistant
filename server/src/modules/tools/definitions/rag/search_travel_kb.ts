import type Anthropic from '@anthropic-ai/sdk';

export const search_travel_kb: Anthropic.Tool = {
  name: 'search_travel_kb',
  description: `Search the travel knowledge base — a curated set of WikiVoyage and Wikipedia articles covering 167 destinations worldwide.

The KB contains stable, slow-changing knowledge:
- WikiVoyage: practical travel guides — neighborhoods and what each offers, local customs and etiquette, how to get around, safety patterns, budget tips, cultural dos and don'ts, hidden spots
- Wikipedia: factual and historical context — city history, geography, cultural significance, demographics

Call this alongside other tools for any destination query. The KB enriches responses with contextual depth that live APIs cannot provide — it answers "what is this place like?" not "what is happening right now?"

Do NOT use for: real-time conditions, current prices, breaking news, or anything that changes frequently. Use get_weather and web_search for those.

Write a specific query combining destination and topic to get the best results.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Specific search query combining the destination name with the topic you need to know about' },
    },
    required: ['query'],
  },
};
