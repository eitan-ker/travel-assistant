import type Anthropic from '@anthropic-ai/sdk';
import { get_weather } from './get_weather.js';
import { get_country_info } from './get_country_info.js';
import { get_attractions } from './get_attractions.js';
import { get_exchange_rate } from './get_exchange_rate.js';
import { search_travel_kb } from './search_travel_kb.js';
import { think_destination_recommendation } from './think_destination_recommendation.js';
import { think_packing_advice } from './think_packing_advice.js';
import { think_local_attractions } from './think_local_attractions.js';
import { think_trip_plan } from './think_trip_plan.js';

export const TRAVEL_TOOLS: Anthropic.Tool[] = [
  get_weather,
  get_country_info,
  get_attractions,
  get_exchange_rate,
  search_travel_kb,
  think_destination_recommendation,
  think_packing_advice,
  think_local_attractions,
  think_trip_plan,
];
