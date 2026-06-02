import type Anthropic from '@anthropic-ai/sdk';

export const think_packing_advice: Anthropic.Tool = {
  name: 'think_packing_advice',
  description: `Use this structured reasoning process when giving packing advice.
Always call this before giving a packing list or packing recommendations.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      destination_climate: { type: 'string', description: 'Climate and weather at the destination during the travel period' },
      trip_length: { type: 'string', description: 'Trip duration (e.g. weekend, 1 week, 2 weeks)' },
      planned_activities: { type: 'string', description: 'Activities planned: beach, hiking, business meetings, city exploring, etc.' },
      essentials: { type: 'string', description: 'Non-negotiable items for this specific trip' },
      nice_to_have: { type: 'string', description: 'Optional items worth considering' },
    },
    required: ['destination_climate', 'trip_length', 'planned_activities', 'essentials'],
  },
};
