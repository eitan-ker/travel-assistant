import type Anthropic from '@anthropic-ai/sdk';

export const get_attractions: Anthropic.Tool = {
  name: 'get_attractions',
  description: `Get real live top attractions and points of interest for a specific location — city, region, island, or landmark area — from OpenTripMap.

Call when:
- User asks what to see, do, or visit in a specific location
- User wants local attractions, hidden gems, or top spots
- User asks about things to do in a place

Do NOT call when:
- User is asking for general destination recommendations without a specific location
- User asks about food/restaurants specifically (use web_search for current recommendations)`,
  input_schema: {
    type: 'object' as const,
    properties: {
      location: {
        type: 'string',
        description: 'The location to fetch attractions for — can be a city, region, island, or landmark area',
      },
    },
    required: ['location'],
  },
};
