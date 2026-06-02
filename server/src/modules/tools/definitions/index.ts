import type Anthropic from '@anthropic-ai/sdk';

// API tools — live external data
import { get_weather } from './api/get_weather.js';
import { get_country_info } from './api/get_country_info.js';
import { get_attractions } from './api/get_attractions.js';
import { get_exchange_rate } from './api/get_exchange_rate.js';

// Chain of thought — structured reasoning
import { think_destination_recommendation } from './chain_of_thought/think_destination_recommendation.js';
import { think_packing_advice } from './chain_of_thought/think_packing_advice.js';
import { think_local_attractions } from './chain_of_thought/think_local_attractions.js';
import { think_trip_plan } from './chain_of_thought/think_trip_plan.js';

// RAG — knowledge base search
import { search_travel_kb } from './rag/search_travel_kb.js';

// Claude server-side — web search
import { web_search } from './claude/web_search.js';

export { web_search };

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
