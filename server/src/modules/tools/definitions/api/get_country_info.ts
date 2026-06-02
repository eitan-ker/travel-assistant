import type Anthropic from '@anthropic-ai/sdk';

export const get_country_info: Anthropic.Tool = {
  name: 'get_country_info',
  description: `Get factual information about a country: capital, currency, languages, region, population.

Call when:
- User asks about factual country data (currency, capital, official language)
- User wants a country overview before visiting

Do NOT call when:
- User asks about culture, food experiences, or what it's like to travel there (use your knowledge)
- Question is about a specific city rather than the country`,
  input_schema: {
    type: 'object' as const,
    properties: {
      country: { type: 'string', description: 'The country name to fetch info for' },
    },
    required: ['country'],
  },
};
