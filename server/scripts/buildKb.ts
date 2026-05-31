import 'dotenv/config';
import { writeFileSync, appendFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { embed } from '../src/rag/embedder.js';
import { UNIQUE_DESTINATIONS } from '../src/rag/destinations.js';
import type { KBDoc } from '../src/rag/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DELAY_MS = 300;
const EMBED_DELAY_MS = 21000; // VoyageAI free tier: 3 RPM → 20s between calls
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Wiki markup cleaner ───────────────────────────────────────────────────────
function cleanWiki(text: string): string {
  return text
    .replace(/\[\[(?:File|Image|thumb)[^\]]*\]\]/gi, '')
    .replace(/thumb\|[^\n]*/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
    .replace(/\[https?:\/\/\S+\]/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, '')
    .replace(/={2,}[^=]+=={2,}/g, '')
    .replace(/'''?/g, '')
    .replace(/\[|\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Fetch WikiVoyage ──────────────────────────────────────────────────────────
async function fetchWikiVoyage(destination: string): Promise<string | null> {
  const url = `https://en.wikivoyage.org/w/api.php?action=query&titles=${encodeURIComponent(destination)}&prop=revisions&rvprop=content&format=json&formatversion=2`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json() as any;
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  return page.revisions?.[0]?.content ?? null;
}

// ── Fetch Wikipedia ───────────────────────────────────────────────────────────
async function fetchWikipedia(destination: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(destination)}&prop=revisions&rvprop=content&format=json&formatversion=2&rvsection=0`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json() as any;
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  return page.revisions?.[0]?.content ?? null;
}

// ── Parse sections ────────────────────────────────────────────────────────────
function parseSections(raw: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let current = 'intro';
  sections[current] = '';
  for (const line of raw.split('\n')) {
    const h = line.match(/^==\s*([^=]+?)\s*==\s*$/);
    if (h) { current = h[1].trim(); sections[current] = ''; }
    else sections[current] = (sections[current] ?? '') + ' ' + line;
  }
  return sections;
}

// ── Build content ─────────────────────────────────────────────────────────────
function buildWikiVoyageContent(destination: string, raw: string): string {
  const secs = parseSections(raw);
  const keep: [string, string][] = [
    ['intro', 'Overview'], ['See', 'See'], ['Do', 'Do'], ['Eat', 'Eat'],
    ['Drink', 'Drink'], ['Stay safe', 'Stay Safe'], ['Stay healthy', 'Stay Healthy'],
    ['Respect', 'Respect'], ['Get around', 'Get Around'],
  ];
  return keep
    .filter(([k]) => secs[k] && cleanWiki(secs[k]).length > 50)
    .map(([k, label]) => `[${label}] ${cleanWiki(secs[k]).slice(0, 500)}`)
    .join('\n\n');
}

function buildWikipediaContent(destination: string, raw: string): string {
  const clean = cleanWiki(raw).slice(0, 2000);
  return `[Overview] ${clean}`;
}

// ── Generate summary via Claude ───────────────────────────────────────────────
function enforceLimit(text: string, limit = 255): string {
  const clean = text.replace(/^#+.*\n?/gm, '').replace(/\*\*[^*]+\*\*/g, '').trim();
  if (clean.length <= limit) return clean;
  const truncated = clean.slice(0, limit);
  return truncated.slice(0, truncated.lastIndexOf(' '));
}

async function generateSummary(destination: string, content: string): Promise<string> {
  const res = await claude.messages.create({
    model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    messages: [{
      role: 'user',
      content: `Write a dense semantic search summary for ${destination}. Return ONLY the summary text — no headers, no labels, no character count. Hard limit: 255 characters.\n\n${content.slice(0, 1000)}`,
    }],
  });
  const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : destination;
  return enforceLimit(raw, 255);
}

// ── Main build ────────────────────────────────────────────────────────────────
async function build() {
  const outDir = join(__dirname, '../data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'kb.jsonl');
  const checkpointPath = join(outDir, 'kb.checkpoint.json');

  // Load existing docs and checkpoint
  const existingIds = new Set<string>();
  let appendMode = false;

  if (existsSync(outPath) && existsSync(checkpointPath)) {
    const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as { completed: string[] };
    checkpoint.completed.forEach((id) => existingIds.add(id));
    appendMode = true;
    console.log(`Resuming from checkpoint — ${existingIds.size} docs already done\n`);
  } else if (existsSync(outPath)) {
    // Fresh start — clear old file
    writeFileSync(outPath, '');
  } else {
    writeFileSync(outPath, '');
  }

  const total = UNIQUE_DESTINATIONS.length;
  console.log(`Building KB for ${total} destinations (${total * 2} docs)...\n`);

  for (let i = 0; i < UNIQUE_DESTINATIONS.length; i++) {
    const dest = UNIQUE_DESTINATIONS[i];
    console.log(`[${i + 1}/${total}] ${dest}`);

    // WikiVoyage
    try {
      const raw = await fetchWikiVoyage(dest);
      if (raw) {
        const content = buildWikiVoyageContent(dest, raw);
        if (content.length > 100) {
          await delay(DELAY_MS);
          const summary = await generateSummary(dest, content);
          await delay(EMBED_DELAY_MS);
          const embedding = await embed(summary);
          docs.push({ id: `${dest.toLowerCase().replace(/\s+/g, '-')}-wikivoyage`, destination: dest, source: 'wikivoyage', summary, content, embedding });
          console.log(`  ✓ WikiVoyage (summary: ${summary.length} chars)`);
        }
      }
    } catch (e) { console.warn(`  ✗ WikiVoyage: ${e instanceof Error ? e.message : e}`); }

    await delay(DELAY_MS);

    // Wikipedia
    try {
      const raw = await fetchWikipedia(dest);
      if (raw) {
        const content = buildWikipediaContent(dest, raw);
        if (content.length > 100) {
          await delay(DELAY_MS);
          const summary = await generateSummary(dest, content);
          await delay(EMBED_DELAY_MS);
          const embedding = await embed(summary);
          docs.push({ id: `${dest.toLowerCase().replace(/\s+/g, '-')}-wikipedia`, destination: dest, source: 'wikipedia', summary, content, embedding });
          console.log(`  ✓ Wikipedia  (summary: ${summary.length} chars)`);
        }
      }
    } catch (e) { console.warn(`  ✗ Wikipedia: ${e instanceof Error ? e.message : e}`); }

    await delay(DELAY_MS);
  }

  writeFileSync(outPath, docs.map((d) => JSON.stringify(d)).join('\n'));
  console.log(`\nDone. ${docs.length} docs written to ${outPath}`);
}

build().catch(console.error);
