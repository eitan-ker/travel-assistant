// Time
export const SECONDS_PER_MINUTE = 60;
export const MS_PER_SECOND = 1_000;
export const MINUTES = SECONDS_PER_MINUTE * MS_PER_SECOND;
export const SESSION_DURATION_MINUTES = 30;
export const SESSION_TTL_MS = SESSION_DURATION_MINUTES * MINUTES;

// LLM token limits
export const MAIN_CHAT_MAX_TOKENS = 8_096;
export const PREFLIGHT_SUPERVISOR_MAX_TOKENS = 256;
export const DATA_SUPERVISOR_MAX_TOKENS = 256;
export const RESPONSE_SUPERVISOR_MAX_TOKENS = 512;
export const COMPACTION_SUMMARY_MAX_TOKENS = 512;

// Pipeline context
export const RECENT_MESSAGE_CONTEXT_CHARS = 300;
export const RECENT_HISTORY_WINDOW_SIZE = 4;
export const HISTORY_MESSAGE_SUMMARY_CHARS = 150;

// Compaction
export const COMPACTION_THRESHOLD_CHARS = 80_000;

// RAG
export const KB_SEARCH_TOP_K = 3;
export const DEFAULT_KB_TOP_K = 3;

// Attractions API
export const DEFAULT_ATTRACTIONS_LIMIT = 10;
export const ATTRACTIONS_SEARCH_RADIUS_METERS = 10_000;
export const ATTRACTIONS_MIN_RATING = 3;

// Supervisor retries
export const MAX_SUPERVISOR_RETRIES = 3;

// Logger
export const LOG_DIVIDER_WIDTH = 60;
export const LOG_FIELD_LABEL_WIDTH = 14;
export const LOG_DRAFT_PREVIEW_CHARS = 120;
export const LOG_TOOL_INPUT_PREVIEW_CHARS = 80;

// User input
export const MAX_MESSAGE_LENGTH_CHARS = 4_000;
