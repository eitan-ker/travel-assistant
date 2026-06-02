import type Anthropic from '@anthropic-ai/sdk';

export const explore_attractions: Anthropic.Tool = {
  name: 'explore_attractions',
  description: `Structured reasoning to find attractions that fit a specific traveler based on their profile.

Purpose: identify 3 distinct locations worth exploring — different neighborhoods, areas, or spots that each offer something unique for this traveler's interests and style.

Call this when the user wants to discover what to see and do — not when they already have a specific place in mind.

Required UserContext fields — ask for these if missing before proceeding:
- interests: what kind of travel they are looking for (beaches, culture, nightlife, adventure, food, nature, etc.)
- traveler_group: solo vs family vs couple shapes which attractions are suitable
- passport: affects which locations are accessible and entry requirements

Optional UserContext fields — use if available, do not ask if missing:
- origin, travel_style, constraints, budget, duration, notes

After completing this reasoning:
1. Call get_attractions for each of the 3 locations
2. Call search_travel_kb for each location
3. Call web_search for current conditions and events
4. End with a compact comparison table: Location | What's there | Best for | Time needed | Accessibility`,
  input_schema: {
    type: 'object' as const,
    properties: {
      origin: { type: 'string', description: 'Where the traveler is coming from — from UserContext' },
      passport: { type: 'array', items: { type: 'string' }, description: 'All passport nationalities — traveler may hold multiple — from UserContext' },
      traveler_group: { type: 'string', description: 'Who they are traveling with — from UserContext' },
      interests: { type: 'string', description: 'Travel interests — beaches, culture, nightlife, adventure, food, nature, etc. — from UserContext' },
      travel_style: { type: 'string', description: 'How they travel — backpacker, mid-range, luxury — from UserContext' },
      constraints: { type: 'string', description: 'Accessibility, dietary, or personal constraints — from UserContext' },
      budget: { type: 'string', description: 'Budget and currency — from UserContext' },
      duration: { type: 'string', description: 'Time available — used to filter out attractions that require more time than the traveler has (e.g. a 3-day trek when only 1 day is available) — from UserContext' },
      notes: { type: 'string', description: 'Any additional traveler context — from UserContext' },
      reasoning: { type: 'string', description: 'Why these 3 locations fit this specific traveler — explain the match for each' },
      location_1: { type: 'string', description: 'First location to fetch attractions for' },
      location_2: { type: 'string', description: 'Second location — must differ from location_1' },
      location_3: { type: 'string', description: 'Third location — must differ from location_1 and location_2' },
    },
    required: ['interests', 'reasoning', 'location_1', 'location_2', 'location_3'],
  },
};
