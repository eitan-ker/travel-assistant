interface VoyageResponse {
  data: { embedding: number[] }[];
}

export async function embed(text: string): Promise<number[]> {
  const key = process.env.VOYAGEAI_API_KEY;
  if (!key) throw new Error('VOYAGEAI_API_KEY is not set');

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`VoyageAI error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as VoyageResponse;
  return data.data[0].embedding;
}
