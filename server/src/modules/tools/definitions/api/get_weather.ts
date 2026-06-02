import type Anthropic from '@anthropic-ai/sdk';

export const get_weather: Anthropic.Tool = {
  name: 'get_weather',
  description: `Get current live weather conditions for a city.

Call when:
- User asks about current/recent weather or temperature in a specific city
- User's packing question implies current conditions matter ("should I bring a raincoat?")
- User wants to know what it's like RIGHT NOW in a place

Do NOT call when:
- User asks about best season or time of year to visit (use your knowledge)
- Question is about general/historical climate patterns`,
  input_schema: {
    type: 'object' as const,
    properties: {
      city: { type: 'string', description: 'The city name to fetch weather for' },
    },
    required: ['city'],
  },
};
