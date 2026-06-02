import type { ToolExecutionResult } from '../tools/types.js';

export interface UserContext {
  destination?: string;
  origin?: string;
  passport?: string;
  interests?: string[];
  budget?: string;
  travelStyle?: string;
  tripDuration?: string;
  travelGroup?: string;
  travelerConstraints?: string;
  notes?: string;
}

export interface ToolCacheEntry {
  result: ToolExecutionResult;
  cachedAt: number;
}

export type ToolCache = Map<string, ToolCacheEntry>;
