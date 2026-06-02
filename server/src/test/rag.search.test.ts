import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchKb } from '../modules/rag/search.js';
import * as loader from '../modules/rag/loader.js';
import * as embedder from '../modules/rag/embedder.js';
import type { KBDoc } from '../modules/rag/types.js';

vi.mock('../modules/rag/loader.js');
vi.mock('../modules/rag/embedder.js');

function makeDoc(id: string, embedding: number[]): KBDoc {
  return {
    id,
    destination: id,
    source: 'wikivoyage',
    summary: `Summary of ${id}`,
    content: `Content about ${id}`,
    embedding,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchKb', () => {
  it('returns empty array when KB is empty', async () => {
    vi.mocked(loader.getKb).mockReturnValue([]);
    vi.mocked(embedder.embed).mockResolvedValue([1, 0]);

    const result = await searchKb('Tokyo', 3);
    expect(result).toEqual([]);
  });

  it('returns empty array when embedding fails (empty result)', async () => {
    vi.mocked(loader.getKb).mockReturnValue([makeDoc('tokyo', [1, 0])]);
    vi.mocked(embedder.embed).mockResolvedValue([]);

    const result = await searchKb('Tokyo', 3);
    expect(result).toEqual([]);
  });

  it('returns top-K most similar docs', async () => {
    const docs = [
      makeDoc('tokyo', [1, 0]),
      makeDoc('paris', [0, 1]),
      makeDoc('bali', [0.9, 0.1]),
    ];
    vi.mocked(loader.getKb).mockReturnValue(docs);
    vi.mocked(embedder.embed).mockResolvedValue([1, 0]); // closest to tokyo and bali

    const result = await searchKb('Japan travel', 2);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('tokyo');
    expect(result[1].id).toBe('bali');
  });

  it('respects topK limit', async () => {
    const docs = [
      makeDoc('tokyo', [1, 0]),
      makeDoc('paris', [0.8, 0.2]),
      makeDoc('bali', [0.6, 0.4]),
      makeDoc('rome', [0.4, 0.6]),
    ];
    vi.mocked(loader.getKb).mockReturnValue(docs);
    vi.mocked(embedder.embed).mockResolvedValue([1, 0]);

    const result = await searchKb('query', 2);
    expect(result).toHaveLength(2);
  });
});
