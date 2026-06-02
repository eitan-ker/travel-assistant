import { embed } from './embedder.js';
import { getKb } from './loader.js';
import type { KBDoc } from '../types.js';
import { DEFAULT_KB_TOP_K } from '../../../shared/constants.js';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function searchKb(query: string, topK = DEFAULT_KB_TOP_K): Promise<KBDoc[]> {
  const kb = getKb();
  if (kb.length === 0) return [];

  const queryEmbedding = await embed(query);
  if (queryEmbedding.length === 0) return [];

  return kb
    .map((doc) => ({ doc, score: cosineSimilarity(queryEmbedding, doc.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ doc }) => doc);
}
