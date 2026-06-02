export interface CountryData {
  name: string;
  capital: string;
  region: string;
  population: number;
  currencies: string[];
  languages: string[];
}

interface RestCountryResponse {
  name: { common: string };
  capital: string[];
  region: string;
  population: number;
  currencies: Record<string, { name: string }>;
  languages: Record<string, string>;
}

export async function getCountryInfo(country: string): Promise<CountryData> {
  const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fields=name,capital,region,population,currencies,languages`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) throw new Error(`Country not found: "${country}"`);
    throw new Error(`Countries API error: ${response.status}`);
  }

  const results = (await response.json()) as RestCountryResponse[];
  if (!results.length) throw new Error(`Country not found: "${country}"`);
  const [data] = results;
  return {
    name: data.name.common,
    capital: data.capital?.[0] ?? 'N/A',
    region: data.region,
    population: data.population,
    currencies: Object.values(data.currencies ?? {}).map((c) => c.name),
    languages: Object.values(data.languages ?? {}),
  };
}
