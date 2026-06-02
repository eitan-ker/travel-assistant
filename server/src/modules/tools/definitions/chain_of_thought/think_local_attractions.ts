import type Anthropic from '@anthropic-ai/sdk';

export const think_local_attractions: Anthropic.Tool = {
  name: 'think_local_attractions',
  description: `Use this structured reasoning process when recommending local things to do, see, or experience.
Call this alongside get_attractions to structure your thinking before responding.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      travel_style: { type: 'string', description: 'User travel style: culture, food, nightlife, nature, off-the-beaten-path, etc.' },
      neighborhood_breakdown: { type: 'string', description: 'Key neighborhoods and what each offers' },
      must_sees: { type: 'string', description: 'Genuine must-see spots (not just tourist traps)' },
      hidden_gems: { type: 'string', description: 'Less obvious but excellent spots worth knowing' },
      food_and_culture: { type: 'string', description: 'Best local food experiences and cultural highlights specific to this city' },
    },
    required: ['travel_style', 'must_sees', 'food_and_culture'],
  },
};
