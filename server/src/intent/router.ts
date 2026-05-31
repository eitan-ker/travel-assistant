export type Intent =
  | 'weather'
  | 'country_info'
  | 'destination_rec'
  | 'packing'
  | 'attractions'
  | 'general';

export interface IntentResult {
  type: Intent;
  entity?: string;
}

const WEATHER_PATTERNS = [
  /weather\s+in\s+([a-z\s]+)/i,
  /temperature\s+in\s+([a-z\s]+)/i,
  /how\s+hot\s+is\s+([a-z\s]+)/i,
  /how\s+cold\s+is\s+([a-z\s]+)/i,
  /is\s+it\s+(?:hot|cold|rainy|sunny|warm)\s+in\s+([a-z\s]+)/i,
  /climate\s+in\s+([a-z\s]+)/i,
];

const COUNTRY_PATTERNS = [
  /tell\s+me\s+about\s+([a-z\s]+)/i,
  /(?:currency|language|capital)\s+(?:in|of)\s+([a-z\s]+)/i,
  /info(?:rmation)?\s+(?:on|about)\s+([a-z\s]+)/i,
  /about\s+([a-z\s]+)\s+country/i,
  /visiting\s+([a-z\s]+)\s+(?:country|nation)/i,
];

const DESTINATION_PATTERNS = [
  /where\s+should\s+i\s+go/i,
  /recommend\s+(?:a\s+)?(?:destination|place|country|city)/i,
  /best\s+(?:place|destination|country|city)\s+(?:to\s+visit|for)/i,
  /where\s+(?:to\s+go|can\s+i\s+go|would\s+you\s+recommend)/i,
  /suggest\s+(?:a\s+)?(?:destination|place|trip)/i,
  /where\s+is\s+(?:good|great|nice|perfect)\s+(?:for|to)/i,
  /plan\s+(?:a\s+)?(?:trip|vacation|holiday)/i,
];

const PACKING_PATTERNS = [
  /(?:what\s+(?:to|should\s+i)\s+pack)/i,
  /packing\s+(?:list|tips?|advice|for)/i,
  /what\s+(?:clothes|clothing|items?|things?)\s+(?:to\s+bring|should\s+i\s+bring)/i,
  /what\s+to\s+bring/i,
];

const ATTRACTION_PATTERNS = [
  /what\s+to\s+(?:see|do|visit)\s+in\s+([a-z\s]+)/i,
  /(?:best|top|must\s+see)\s+(?:places?|attractions?|sights?|things?)\s+in\s+([a-z\s]+)/i,
  /local\s+(?:food|cuisine|restaurants?|spots?)\s+in\s+([a-z\s]+)/i,
  /(?:hidden\s+gems?|highlights?)\s+in\s+([a-z\s]+)/i,
];

function extractEntity(msg: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[?.!,]+$/, '');
  }
  return undefined;
}

export function classifyIntent(message: string): IntentResult {
  const entity = extractEntity(message, WEATHER_PATTERNS);
  if (entity) return { type: 'weather', entity };

  const countryEntity = extractEntity(message, COUNTRY_PATTERNS);
  if (countryEntity) return { type: 'country_info', entity: countryEntity };

  if (DESTINATION_PATTERNS.some((p) => p.test(message))) {
    return { type: 'destination_rec' };
  }

  if (PACKING_PATTERNS.some((p) => p.test(message))) {
    return { type: 'packing' };
  }

  const attractionEntity = extractEntity(message, ATTRACTION_PATTERNS);
  if (attractionEntity) return { type: 'attractions', entity: attractionEntity };

  return { type: 'general' };
}
