export const USER_CONTEXT_PROMPT = `Extract any new information from the user's message about themselves or their trip. Only extract what is explicitly stated — do not infer or guess. If nothing new is revealed, do not call the tool.

Key fields to watch for:
- destination: any place they mention traveling to or asking about — update if they switch destinations
- passport: their nationality or passport country
- travelerConstraints: accessibility needs, dietary requirements, or any personal travel limitations`;
