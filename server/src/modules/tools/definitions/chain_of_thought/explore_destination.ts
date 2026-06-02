import type Anthropic from '@anthropic-ai/sdk';

export const explore_destination: Anthropic.Tool = {
  name: 'explore_destination',
  description: `Structured reasoning to find the best travel destinations for a specific traveler based on their profile.

Purpose: identify 3 destinations that genuinely match this traveler — personalized to their interests, style, constraints, budget, and origin. Not generic recommendations.

Required UserContext fields — ask for these if missing before proceeding:
- interests: what kind of travel they are looking for (beaches, culture, nightlife, adventure, food, nature, hiking, etc.)
- passport: nationality affects which destinations are accessible visa-free — critical for filtering recommendations

Optional UserContext fields — use if available, do not ask if missing:
- origin, traveler_group, travel_style, constraints, budget, duration, notes

After completing this reasoning:
1. Call get_country_info, get_weather, AND get_attractions for EACH of the 3 destinations
2. Call search_travel_kb for each destination
3. Call web_search for each destination
4. Present all 3 options using only what the live tools returned — weather, country facts, and attractions
5. End with a compact comparison table: Destination | Weather | Best for | Safety

Strict content rules — do NOT include in this response:
- Specific prices (flights, hotels, meals, entrance fees)
- Specific accessibility details or infrastructure claims
- Specific transport times or schedules
These belong in explore_trip after the user confirms a destination.

6. Wait for the user to confirm one before moving forward`,
  input_schema: {
    type: 'object' as const,
    properties: {
      origin: { type: 'string', description: 'Where the traveler is coming from — from UserContext' },
      passport: { type: 'array', items: { type: 'string' }, description: 'All passport nationalities — traveler may hold multiple — from UserContext' },
      traveler_group: { type: 'string', description: 'Who they are traveling with — from UserContext' },
      interests: { type: 'string', description: 'Travel interests — beaches, culture, food, nightlife, adventure, etc. — from UserContext' },
      travel_style: { type: 'string', description: 'How they travel — backpacker, mid-range, luxury — from UserContext' },
      constraints: { type: 'string', description: 'Accessibility, dietary, or personal constraints — from UserContext' },
      budget: { type: 'string', description: 'Budget and currency — from UserContext' },
      duration: { type: 'string', description: 'Trip length — from UserContext' },
      notes: { type: 'string', description: 'Any additional traveler context — from UserContext' },
      reasoning: { type: 'string', description: 'Why these 3 destinations fit this specific traveler — explain the match for each' },
      destination_1: { type: 'string', description: 'First destination — city and country' },
      destination_2: { type: 'string', description: 'Second destination — must differ from destination_1' },
      destination_3: { type: 'string', description: 'Third destination — must differ from destination_1 and destination_2' },
    },
    required: ['interests', 'passport', 'reasoning', 'destination_1', 'destination_2', 'destination_3'],
  },
};
