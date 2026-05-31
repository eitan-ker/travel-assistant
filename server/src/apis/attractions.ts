export interface Attraction {
  name: string;
  kinds: string;
  rate: number;
}

interface GeonameResponse {
  lat: number;
  lon: number;
  name: string;
}

interface OTMPlace {
  name: string;
  kinds: string;
  rate: number;
  dist: number;
}

async function getCityCoords(city: string, apiKey: string): Promise<{ lat: number; lon: number }> {
  const url = `https://api.opentripmap.com/0.1/en/places/geoname?name=${encodeURIComponent(city)}&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenTripMap geoname error: ${res.status}`);
  const data = (await res.json()) as GeonameResponse;
  if (!data.lat || !data.lon) throw new Error(`City not found: "${city}"`);
  return { lat: data.lat, lon: data.lon };
}

export async function getAttractions(city: string, limit = 10): Promise<Attraction[]> {
  const key = process.env.OPENTRIPMAP_API_KEY;
  if (!key) throw new Error('OPENTRIPMAP_API_KEY is not set');

  const { lat, lon } = await getCityCoords(city, key);

  const url = `https://api.opentripmap.com/0.1/en/places/radius` +
    `?radius=10000&lon=${lon}&lat=${lat}` +
    `&kinds=interesting_places` +
    `&rate=3&limit=${limit}` +
    `&format=json` +
    `&apikey=${key}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenTripMap error: ${res.status}`);

  const data = (await res.json()) as OTMPlace[];
  return data
    .filter((p) => p.name)
    .map((p) => ({
      name: p.name,
      kinds: p.kinds.replace(/_/g, ' '),
      rate: p.rate,
    }));
}
