import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { KBDoc } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_PATH = join(__dirname, '../../data/kb.jsonl');

let kb: KBDoc[] = [];

export function loadKb(): void {
  if (!existsSync(KB_PATH)) {
    console.warn('[rag] kb.jsonl not found — run scripts/buildKb.ts to build the knowledge base');
    return;
  }
  const lines = readFileSync(KB_PATH, 'utf-8').trim().split('\n').filter(Boolean);
  kb = lines.map((l) => JSON.parse(l) as KBDoc);
  console.log(`[rag] loaded ${kb.length} docs from kb.jsonl`);
}

export function getKb(): KBDoc[] {
  return kb;
}
