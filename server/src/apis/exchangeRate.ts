export interface ExchangeRateData {
  base: string;
  target: string;
  rate: number;
  date: string;
}

interface FrankfurterResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export async function getExchangeRate(from: string, to: string): Promise<ExchangeRateData> {
  const url = `https://api.frankfurter.app/latest?from=${from.toUpperCase()}&to=${to.toUpperCase()}`;
  const response = await fetch(url);

  if (!response.ok) throw new Error(`Exchange rate error: ${response.status}`);

  const data = (await response.json()) as FrankfurterResponse;
  const rate = data.rates[to.toUpperCase()];

  if (!rate) throw new Error(`Currency not found: ${to}`);

  return { base: from.toUpperCase(), target: to.toUpperCase(), rate, date: data.date };
}
