import type Anthropic from '@anthropic-ai/sdk';

export const think_destination_recommendation: Anthropic.Tool = {
  name: 'think_destination_recommendation',
  description: `Use this structured reasoning process when recommending travel destinations.
Always call this before giving destination recommendations.

After filling this in:
1. Call get_country_info, get_weather, AND get_attractions for EACH of your 3 shortlisted destinations
2. For get_weather and get_attractions, always use the main tourist city or capital — not regional or obscure cities
3. Use that live data to enrich and validate each recommendation
4. Present all 3 options to the user with real, grounded reasoning (current weather, country facts, top attractions)
5. Do NOT jump to packing or itinerary — wait for the user to confirm a destination first.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      budget_level: { type: 'string', description: 'Budget level from user: budget / mid-range / luxury / unspecified' },
      travel_season: { type: 'string', description: 'When the user is traveling and what that means for weather and crowds' },
      interests: { type: 'string', description: 'User interests: adventure, culture, food, relaxation, nightlife, nature, etc.' },
      shortlist: { type: 'string', description: 'Exactly 3 destinations that best match the above criteria — list them as: "1. City, Country — reason"' },
      top_pick: { type: 'string', description: 'The single strongest match and the specific reason it fits this user' },
    },
    required: ['budget_level', 'travel_season', 'interests', 'shortlist', 'top_pick'],
  },
};
