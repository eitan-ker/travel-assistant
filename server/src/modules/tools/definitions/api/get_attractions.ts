import type Anthropic from '@anthropic-ai/sdk';

export const get_attractions: Anthropic.Tool = {
  name: 'get_attractions',
  description: `Get real live top attractions and points of interest in a specific city from OpenTripMap.

Call when:
- User asks what to see, do, or visit in a specific city
- User wants local attractions, hidden gems, or top spots
- User asks about things to do in a place

Do NOT call when:
- User is asking for general destination recommendations without a specific city
- User asks about food/restaurants specifically (use your knowledge)`,
  input_schema: {
    type: 'object' as const,
    properties: {
      city: { type: 'string', description: 'The city name to fetch attractions for' },
    },
    required: ['city'],
  },
};
