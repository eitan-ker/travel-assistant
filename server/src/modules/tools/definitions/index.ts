import type Anthropic from '@anthropic-ai/sdk';

// API tools — live external data
import { get_weather } from './api/get_weather.js';
import { get_country_info } from './api/get_country_info.js';
import { get_attractions } from './api/get_attractions.js';
import { get_exchange_rate } from './api/get_exchange_rate.js';

// Chain of thought — structured reasoning
import { explore_destination } from './chain_of_thought/explore_destination.js';
import { explore_attractions } from './chain_of_thought/explore_attractions.js';
import { think_packing_advice } from './chain_of_thought/think_packing_advice.js';
import { explore_trip } from './chain_of_thought/explore_trip.js';

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
  explore_destination,
  explore_attractions,
  think_packing_advice,
  explore_trip,
];
