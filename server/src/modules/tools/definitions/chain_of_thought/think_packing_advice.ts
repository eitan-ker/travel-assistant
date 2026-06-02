import type Anthropic from '@anthropic-ai/sdk';

export const think_packing_advice: Anthropic.Tool = {
  name: 'think_packing_advice',
  description: `Structured reasoning to give personalized packing advice based on the traveler's full profile.

Purpose: determine what this specific traveler needs to bring — considering their destination, activities, travel style, budget, and constraints. Packing advice is personal, not generic.

Required UserContext fields — ask for these if missing before proceeding:
- destination: packing advice without a destination is not possible
- origin: affects power adapter type, climate transition (hot to cold), and what to bring from home vs buy there
- passport: entry requirements may restrict certain items; nationality affects what to prepare for customs
- traveler_group: solo vs family vs couple changes luggage strategy and what to share
- interests: activities determine what gear is essential (hiking vs beach vs nightlife vs city)
- travel_style: budget affects bring-vs-buy decisions; luxury vs backpacker changes luggage type entirely
- budget: determines whether to buy items at destination or bring from home
- duration: longer trips require more clothing or laundry planning; affects how much to pack

Optional UserContext fields — use if available, do not ask if missing:
- constraints, notes

After completing this reasoning:
1. Call get_weather for current conditions at the destination
2. Call get_exchange_rate to understand local purchasing power (what to bring vs buy there)
3. Call web_search for current advisories and entry requirements that affect packing
4. Call search_travel_kb for local customs and dress codes at the destination`,
  input_schema: {
    type: 'object' as const,
    properties: {
      destination: { type: 'string', description: 'The destination — from UserContext' },
      origin: { type: 'string', description: 'Where the traveler is coming from — from UserContext' },
      passport: { type: 'array', items: { type: 'string' }, description: 'All passport nationalities — traveler may hold multiple — from UserContext' },
      traveler_group: { type: 'string', description: 'Who they are traveling with — from UserContext' },
      interests: { type: 'string', description: 'Planned activities — from UserContext' },
      travel_style: { type: 'string', description: 'How they travel — affects luggage type and amount — from UserContext' },
      constraints: { type: 'string', description: 'Dietary, medical, or personal constraints that affect packing — from UserContext' },
      budget: { type: 'string', description: 'Budget — affects bring vs buy decisions — from UserContext' },
      duration: { type: 'string', description: 'Trip length — affects how much to pack — from UserContext' },
      notes: { type: 'string', description: 'Any additional traveler context — from UserContext' },
      essentials: { type: 'string', description: 'Non-negotiable items for this specific trip and traveler' },
      nice_to_have: { type: 'string', description: 'Optional items worth considering for this traveler' },
      buy_there: { type: 'string', description: 'Items better purchased at the destination given local prices and availability' },
    },
    required: ['essentials'],
  },
};
