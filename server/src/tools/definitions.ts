import Anthropic from '@anthropic-ai/sdk';

export const TRAVEL_TOOLS: Anthropic.Tool[] = [
  // ── API Tools ────────────────────────────────────────────────────────────
  {
    name: 'get_weather',
    description: `Get current live weather conditions for a city.

Call when:
- User asks about current/recent weather or temperature in a specific city
- User's packing question implies current conditions matter ("should I bring a raincoat?")
- User wants to know what it's like RIGHT NOW in a place

Do NOT call when:
- User asks about best season or time of year to visit (use your knowledge)
- Question is about general/historical climate patterns`,
    input_schema: {
      type: 'object' as const,
      properties: {
        city: {
          type: 'string',
          description: 'The city name to fetch weather for (e.g. "Tokyo", "Paris")',
        },
      },
      required: ['city'],
    },
  },
  {
    name: 'get_country_info',
    description: `Get factual information about a country: capital, currency, languages, region, population.

Call when:
- User asks about factual country data (currency, capital, official language)
- User wants a country overview before visiting

Do NOT call when:
- User asks about culture, food experiences, or what it's like to travel there (use your knowledge)
- Question is about a specific city rather than the country`,
    input_schema: {
      type: 'object' as const,
      properties: {
        country: {
          type: 'string',
          description: 'The country name to fetch info for (e.g. "Japan", "France")',
        },
      },
      required: ['country'],
    },
  },
  {
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
        city: {
          type: 'string',
          description: 'The city name to fetch attractions for (e.g. "Tokyo", "Barcelona")',
        },
      },
      required: ['city'],
    },
  },

  {
    name: 'get_exchange_rate',
    description: `Get the live exchange rate between two currencies. No API key required.

Call when:
- User mentions a budget in their currency and you need to convert to destination currency
- Building a budget breakdown for a trip plan
- User asks about local prices or how far their money will go

Do NOT call when:
- User is asking a general question with no specific budget mentioned`,
    input_schema: {
      type: 'object' as const,
      properties: {
        from_currency: {
          type: 'string',
          description: 'Source currency code (e.g. "USD", "THB", "EUR")',
        },
        to_currency: {
          type: 'string',
          description: 'Target currency code (e.g. "ILS", "JPY", "EUR")',
        },
      },
      required: ['from_currency', 'to_currency'],
    },
  },

  // ── Reasoning Tools ──────────────────────────────────────────────────────
  {
    name: 'think_destination_recommendation',
    description: `Use this structured reasoning process when recommending travel destinations.
Always call this before giving destination recommendations.

After filling this in:
1. Call get_country_info, get_weather, AND get_attractions for EACH of your 3 shortlisted destinations
2. Use that live data to enrich and validate each recommendation
3. Present all 5 options to the user with real, grounded reasoning (current weather, country facts, top attractions)
4. Do NOT jump to packing or itinerary — wait for the user to confirm a destination first.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        budget_level: {
          type: 'string',
          description: 'Budget level from user: budget / mid-range / luxury / unspecified',
        },
        travel_season: {
          type: 'string',
          description: 'When the user is traveling and what that means for weather and crowds',
        },
        interests: {
          type: 'string',
          description: 'User interests: adventure, culture, food, relaxation, nightlife, nature, etc.',
        },
        shortlist: {
          type: 'string',
          description: 'Exactly 3 destinations that best match the above criteria — list them as: "1. City, Country — reason"',
        },
        top_pick: {
          type: 'string',
          description: 'The single strongest match and the specific reason it fits this user',
        },
      },
      required: ['budget_level', 'travel_season', 'interests', 'shortlist', 'top_pick'],
    },
  },
  {
    name: 'think_packing_advice',
    description: `Use this structured reasoning process when giving packing advice.
Always call this before giving a packing list or packing recommendations.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        destination_climate: {
          type: 'string',
          description: 'Climate and weather at the destination during the travel period',
        },
        trip_length: {
          type: 'string',
          description: 'Trip duration (e.g. weekend, 1 week, 2 weeks)',
        },
        planned_activities: {
          type: 'string',
          description: 'Activities planned: beach, hiking, business meetings, city exploring, etc.',
        },
        essentials: {
          type: 'string',
          description: 'Non-negotiable items for this specific trip',
        },
        nice_to_have: {
          type: 'string',
          description: 'Optional items worth considering',
        },
      },
      required: ['destination_climate', 'trip_length', 'planned_activities', 'essentials'],
    },
  },
  {
    name: 'think_local_attractions',
    description: `Use this structured reasoning process when recommending local things to do, see, or experience.
Call this alongside get_attractions to structure your thinking before responding.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        travel_style: {
          type: 'string',
          description: 'User travel style: culture, food, nightlife, nature, off-the-beaten-path, etc.',
        },
        neighborhood_breakdown: {
          type: 'string',
          description: 'Key neighborhoods and what each offers',
        },
        must_sees: {
          type: 'string',
          description: 'Genuine must-see spots (not just tourist traps)',
        },
        hidden_gems: {
          type: 'string',
          description: 'Less obvious but excellent spots worth knowing',
        },
        food_and_culture: {
          type: 'string',
          description: 'Best local food experiences and cultural highlights specific to this city',
        },
      },
      required: ['travel_style', 'must_sees', 'food_and_culture'],
    },
  },
  {
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
        destination: {
          type: 'string',
          description: 'The destination city and country',
        },
        origin: {
          type: 'string',
          description: 'Where the traveler is flying from — used to assess visa requirements and flight options',
        },
        duration: {
          type: 'string',
          description: 'Trip length (e.g. "2 weeks", "10 days")',
        },
        budget: {
          type: 'string',
          description: 'Total budget and currency (e.g. "$5,000", "€2,000", "unspecified")',
        },
        travel_style: {
          type: 'string',
          description: 'What the traveler wants: beach, nightlife, culture, adventure, food, relaxation, mix',
        },
        visa_situation: {
          type: 'string',
          description: 'Visa requirements for this traveler (origin passport → destination country)',
        },
        getting_there: {
          type: 'string',
          description: 'How to get from origin to destination — flight options, typical duration, cost range',
        },
        accommodation: {
          type: 'string',
          description: 'Recommended area to stay, type (hotel/Airbnb/hostel), and ballpark nightly cost',
        },
        weekly_structure: {
          type: 'string',
          description: 'Day-by-day or week-by-week breakdown of the trip — what to do, see, and experience',
        },
        day_trips: {
          type: 'string',
          description: 'Recommended day trips from the destination with travel time and highlights',
        },
        budget_breakdown: {
          type: 'string',
          description: 'Estimated cost breakdown by category: flights, accommodation, food, activities, transport',
        },
        practical_tips: {
          type: 'string',
          description: 'Essential tips: weather, what to pack, local customs, transport, safety, currency',
        },
      },
      required: ['destination', 'origin', 'duration', 'travel_style', 'visa_situation', 'getting_there', 'accommodation', 'weekly_structure', 'budget_breakdown'],
    },
  },
];
