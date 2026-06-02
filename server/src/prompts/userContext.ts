export const USER_CONTEXT_PROMPT = `Extract any new information from the user's message about themselves or their trip. Only extract what is explicitly stated — do not infer or guess. If nothing new is revealed, do not call the tool.

Key fields to watch for:
- destination: any place they mention traveling to or asking about — update if they switch destinations
- passport: their nationality or passport country
- interests: travel interests or activities mentioned (beach, culture, food, nightlife, hiking, relaxation, etc.)
- travelStyle: how they travel — solo, couple, family, backpacker, luxury, etc.
- budget: any budget amount or level mentioned
- tripDuration: how long the trip is
- origin: where they are flying from or their home city/country
- travelerConstraints: accessibility needs, dietary requirements, or any personal travel limitations`;
