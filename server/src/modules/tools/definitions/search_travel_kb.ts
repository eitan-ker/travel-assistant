import type Anthropic from '@anthropic-ai/sdk';

export const search_travel_kb: Anthropic.Tool = {
  name: 'search_travel_kb',
  description: `Search the travel knowledge base (WikiVoyage + Wikipedia) for destination-specific intelligence.

Call when:
- A specific destination is mentioned and deeper local knowledge would enrich the response
- User asks about local etiquette, customs, or cultural dos and don'ts
- User asks about safety, scams, or warnings for a specific destination
- User asks about transportation tips or getting around
- User asks about neighborhood character or hidden spots
- Combine with live API data when available — KB and live APIs complement each other

Do NOT call when:
- No specific destination is mentioned
- The query is purely about real-time conditions already covered by get_weather`,
  input_schema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'The search query — describe what you need to know' },
    },
    required: ['query'],
  },
};
