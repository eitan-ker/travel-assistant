import type Anthropic from '@anthropic-ai/sdk';

export const get_exchange_rate: Anthropic.Tool = {
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
      from_currency: { type: 'string', description: 'Source currency code (e.g. "USD", "ILS", "EUR")' },
      to_currency: { type: 'string', description: 'Target currency code (e.g. "ILS", "JPY", "EUR")' },
    },
    required: ['from_currency', 'to_currency'],
  },
};
