import type Anthropic from '@anthropic-ai/sdk';

export const think_trip_plan: Anthropic.Tool = {
  name: 'think_trip_plan',
  description: `Use this to build a complete trip plan when the user has a destination and wants help planning the full trip.

Call this when the user says things like "help me plan a trip to X", "I'm going to X for N weeks", or asks for a full plan.

Before calling this tool, make sure you have gathered:
- destination
- duration
- origin / where they're flying from (needed for visa and flight context)
- budget (ask if not given)
- travel style / interests

After filling this in, ALSO call these tools to get live data:
- get_weather(destination) — LIVE current conditions ✓
- get_country_info(destination) — LIVE facts, currency name, language ✓
- get_attractions(destination) — LIVE top things to do ✓
- get_exchange_rate(user_currency, destination_currency) — LIVE conversion rate ✓

Data transparency rules — be explicit in your response:
- Weather, country facts, attractions, exchange rate → label as "live data"
- Flight prices → label as "estimated — verify on Google Flights/Skyscanner"
- Hotel prices → label as "estimated — check Booking.com/Airbnb for current rates"
- Visa requirements → label as "based on general knowledge — verify at official embassy"

Never present estimates as verified facts.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      destination: { type: 'string', description: 'The destination city and country' },
      origin: { type: 'string', description: 'Where the traveler is flying from — used to assess visa requirements and flight options' },
      duration: { type: 'string', description: 'Trip length (e.g. "2 weeks", "10 days")' },
      budget: { type: 'string', description: 'Total budget and currency (e.g. "$5,000", "€2,000", "unspecified")' },
      travel_style: { type: 'string', description: 'What the traveler wants: beach, nightlife, culture, adventure, food, relaxation, mix' },
      visa_situation: { type: 'string', description: 'Visa requirements for this traveler (origin passport → destination country)' },
      getting_there: { type: 'string', description: 'How to get from origin to destination — flight options, typical duration, cost range' },
      accommodation: { type: 'string', description: 'Recommended area to stay, type (hotel/Airbnb/hostel), and ballpark nightly cost' },
      weekly_structure: { type: 'string', description: 'Day-by-day or week-by-week breakdown of the trip — what to do, see, and experience' },
      day_trips: { type: 'string', description: 'Recommended day trips from the destination with travel time and highlights' },
      budget_breakdown: { type: 'string', description: 'Estimated cost breakdown by category: flights, accommodation, food, activities, transport' },
      practical_tips: { type: 'string', description: 'Essential tips: weather, what to pack, local customs, transport, safety, currency' },
    },
    required: ['destination', 'origin', 'duration', 'travel_style', 'visa_situation', 'getting_there', 'accommodation', 'weekly_structure', 'budget_breakdown'],
  },
};
