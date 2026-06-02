import type Anthropic from '@anthropic-ai/sdk';

export const explore_trip: Anthropic.Tool = {
  name: 'explore_trip',
  description: `The master trip planning workflow. Use this when the user has a confirmed destination and wants a complete, actionable trip plan — from the moment they leave home to the moment they return.

Purpose: build a full departure-to-return plan the user can actually follow. Not a highlights list — a complete travel guide personalized to this specific traveler, grounded in live data.

Required UserContext fields — ask for these if missing before proceeding:
- destination: the confirmed destination city and country
- origin: where they are flying from
- duration: how long the trip is
- budget: total budget and currency
- passport: nationality affects visa requirements and entry
- traveler_group: who they are traveling with affects accommodation and itinerary
- interests: what they want to do shapes the whole plan
- travel_style: budget/mid-range/luxury shapes every recommendation

Optional UserContext fields — use if available, do not ask if missing:
- constraints, notes

The plan must cover:
- Getting there: flights from origin, travel time, connection options
- Visa and entry: based on passport and destination country
- Where to stay: neighborhoods, accommodation types, price ranges matching their style and budget
- Day-by-day itinerary: what to do, see, and eat — structured around interests, group, and constraints
- Day trips: nearby destinations worth adding if duration allows
- Budget breakdown: flights, accommodation, food, activities, local transport
- Packing essentials: what to bring for this destination, season, and traveler
- Practical tips: local customs, transport, safety, currency, language

After completing this reasoning, call ALL of the following:
- get_weather(destination)
- get_country_info(destination)
- get_attractions(destination)
- get_exchange_rate(origin_currency, destination_currency)
- search_travel_kb(destination)
- web_search(destination)

Data transparency — label clearly in your response:
- Weather, country facts, attractions, exchange rate → "live data"
- Flight prices → "estimated — verify on Google Flights/Skyscanner"
- Hotel prices → "estimated — check Booking.com/Airbnb for current rates"
- Visa requirements → "based on general knowledge — verify at official embassy"

Never present estimates as verified facts.`,
  input_schema: {
    type: 'object' as const,
    properties: {
      destination: { type: 'string', description: 'Confirmed destination city and country — from UserContext' },
      origin: { type: 'string', description: 'Where the traveler is flying from — from UserContext' },
      passport: { type: 'array', items: { type: 'string' }, description: 'All passport nationalities — traveler may hold multiple, use most advantageous — from UserContext' },
      duration: { type: 'string', description: 'Trip length — from UserContext' },
      budget: { type: 'string', description: 'Total budget and currency — from UserContext' },
      traveler_group: { type: 'string', description: 'Who they are traveling with — from UserContext' },
      interests: { type: 'string', description: 'Travel interests — from UserContext' },
      travel_style: { type: 'string', description: 'How they travel — from UserContext' },
      constraints: { type: 'string', description: 'Accessibility, dietary, or personal constraints — from UserContext' },
      notes: { type: 'string', description: 'Any additional context about this traveler — from UserContext' },
      visa_situation: { type: 'string', description: 'Visa requirements for this traveler (origin passport → destination country)' },
      getting_there: { type: 'string', description: 'How to get from origin to destination — flight options, duration, cost range' },
      accommodation: { type: 'string', description: 'Recommended area to stay, type, and ballpark nightly cost' },
      weekly_structure: { type: 'string', description: 'Day-by-day or week-by-week breakdown — what to do, see, and experience' },
      day_trips: { type: 'string', description: 'Recommended day trips from the destination with travel time and highlights' },
      budget_breakdown: { type: 'string', description: 'Estimated cost breakdown by category: flights, accommodation, food, activities, transport' },
      packing_essentials: { type: 'string', description: 'Key items to pack for this specific trip, destination, and traveler' },
    },
    required: ['destination', 'origin', 'duration', 'visa_situation', 'getting_there', 'accommodation', 'weekly_structure', 'budget_breakdown'],
  },
};
