# Travel Assistant

A conversational travel planning assistant built on Claude. Designed to demonstrate state-of-the-art prompt engineering, multi-agent supervision, real-time data augmentation, and intelligent context management — going far beyond a basic LLM wrapper.

---

## What Makes This System Different

Most LLM travel assistants are a system prompt + one API call. This system is an **intelligent pipeline** with multiple specialized agents, quality gates, live data fusion, and memory — built to be robust and efficient

Key innovations:
- **Pre-flight intent supervision** — validates context before firing expensive tool calls
- **3-stage quality supervisor pipeline** — catches hallucinations, wrong data, and bad tool selection
- **CLARIFY verdict** — detects genuine ambiguity and asks the user instead of guessing
- **Tool result cache** — prevents redundant API calls within a session (significant cost reduction)
- **History compaction** — prevents context window bloat on long conversations
- **RAG knowledge base** — 322 curated travel documents (WikiVoyage + Wikipedia) for stable local knowledge
- **Session UserContext** — builds and persists a traveler profile across the entire conversation
- **Parallel execution** — all tool calls within a response run concurrently via `Promise.all`

---

## System Architecture

```
Browser (React + Vite)
  └── POST /chat { message, sessionId }
        └── Express Server (Node.js + TypeScript)
              └── Pipeline
                    │
                    ├── 1. UserContext Extraction (parallel, background)
                    │      └── Lightweight Claude call extracts traveler profile from every message
                    │
                    ├── 2. Pre-flight Intent Supervisor
                    │      └── PASS → tools run | CLARIFY → ask user (skip tools entirely)
                    │
                    ├── 3. Travel Agent (Claude with 10 tools)
                    │      ├── API Tools (live external data)
                    │      │     ├── get_weather(city)         → OpenWeatherMap
                    │      │     ├── get_country_info(country) → RestCountries
                    │      │     ├── get_attractions(location) → OpenTripMap
                    │      │     ├── get_exchange_rate(from,to)→ Frankfurter (ECB)
                    │      │     └── search_travel_kb(query)   → RAG (322 docs, VoyageAI)
                    │      ├── Chain-of-Thought Reasoning Tools
                    │      │     ├── explore_destination       → 3 destination recommendations
                    │      │     ├── explore_attractions       → 3 location discoveries
                    │      │     ├── think_packing_advice      → personalized packing list
                    │      │     └── explore_trip              → complete departure-to-return plan
                    │      └── Server-side Web Search
                    │            └── web_search → Anthropic built-in, live news & advisories
                    │
                    ├── 4. Data Supervisor (per tool call)
                    │      └── Validates API data matches the query: PASS / REFINE / CLARIFY
                    │
                    ├── 5. Response Supervisor
                    │      └── Quality gate: hallucinations, verbosity, unanswered: PASS / REFINE
                    │
                    ├── 6. Tool Result Cache
                    │      └── Caches API results within session — prevents redundant calls
                    │
                    └── 7. History Compaction
                           └── Summarizes old turns when conversation grows too large
```

---

## Prompt Engineering Deep Dive

### 1. LLM as the Decision Engine

Claude receives all 10 tools and decides autonomously when to call them. The system prompt defines a strict decision philosophy:

- **Live data that changes** → call an API tool
- **Stable knowledge** → use RAG knowledge base
- **General travel advice** → Claude's training knowledge
- **Current news** → web search

This replaces a rule-based intent classifier — Claude IS the decision method.

### 2. Chain-of-Thought Reasoning Tools

Four structured reasoning tools force Claude through multi-step thinking before responding. Each tool schema is itself a chain-of-thought — the fields ARE the reasoning steps.

**`explore_destination`** — identifies 3 personalized destination matches based on full traveler profile (interests, passport, budget, origin, group, style, constraints). Required fields include passport (visa filtering) and interests. After reasoning, fires `get_country_info + get_weather + get_attractions` × 3 destinations + `search_travel_kb` + `web_search` for each. Ends with a comparison table.

**`explore_attractions`** — identifies 3 distinct locations to explore based on traveler profile. Required: interests, traveler_group, passport. After reasoning, fires `get_attractions` × 3 locations + `search_travel_kb` + `web_search`.

**`think_packing_advice`** — determines what this specific traveler needs to bring. Required: destination, origin (power adapters, climate transition), passport (entry restrictions), interests, travel_style, traveler_group, budget, duration. After reasoning, fires `get_weather` + `get_exchange_rate` + `web_search` + `search_travel_kb`.

**`explore_trip`** — the master workflow. Builds a complete departure-to-return plan. Required: destination, origin, duration, budget, passport, traveler_group, interests, travel_style. After reasoning, fires all API tools + KB + web search. Output covers: getting there, visa, accommodation, day-by-day itinerary, day trips, budget breakdown, packing essentials, practical tips.

### 3. Supervisor Pipeline (Pre-flight + Data + Response)

Three specialized supervisors each own one concern. The pre-flight runs before any tools fire; data and response run after.

**Pre-flight** runs first using a two-step reasoning protocol: (1) did the agent just ask a question? If yes, the user is answering it → PASS immediately. (2) Is there a genuine place-name collision between equally well-known locations? → CLARIFY with specific options. This prevents wasting 12+ API calls on insufficient context and prevents false CLARIFYs when users are simply answering questions.

Three specialized supervisors, each owning one concern:

| Supervisor | Fires | Checks | Verdicts |
|---|---|---|---|
| Pre-flight | Before tools | Enough context to proceed? Ambiguous? | PASS / CLARIFY |
| Data | After each API call | Did we fetch the right data? | PASS / REFINE / CLARIFY |
| Response | After Travel Agent | Quality, hallucinations, verbosity | PASS / REFINE |

**CLARIFY verdict**: When a supervisor detects genuine ambiguity (e.g. "Paris" → France or Texas?), the pipeline short-circuits — returns a targeted question to the user, zero tools fired, zero tokens wasted.

**REFINE verdict**: Supervisor provides specific feedback, Travel Agent retries with corrective context. Response Supervisor retries with `disableTools=true` to avoid re-running expensive tool calls.

**Supervisor robustness**: Each supervisor retries up to 3 times if it returns empty reasoning. Falls back to PASS on 3rd failure — a verdict without reasoning is untrustworthy.

### 5. RAG Knowledge Base

322 documents from WikiVoyage (160) and Wikipedia (163) covering 167 destinations worldwide. Built offline using VoyageAI `voyage-3-lite` embeddings.

**What it contains**: WikiVoyage provides practical travel guides — neighborhoods, local customs, etiquette, safety patterns, transportation culture, hidden spots. Wikipedia provides factual and historical context — city history, geography, cultural significance.

**Why offline**: This is stable knowledge that doesn't change week-to-week. Fetching it at query time via web search would waste tokens and latency on static information.

**How it works**: At query time, the search query is embedded with VoyageAI and top-3 documents retrieved via cosine similarity. The KB answers "what is this place like?" — complementing live APIs which answer "what is happening right now?"

### 6. Tool Result Cache

Every successful API call result is cached in the session with a 30-minute TTL. Cache key is normalized (e.g. `"Bali, Indonesia"` and `"Bali"` hit the same key). 

**Impact**: A destination recommendation query fires 13+ API calls. If the user follows up about the same destinations, all those calls return from cache — zero API cost, near-zero latency. The cache content is also injected into the system prompt so Claude knows not to re-fetch.

### 7. History Compaction

When conversation history exceeds 80,000 characters (~20,000 tokens, 40% of the rate limit), the pipeline triggers compaction. A lightweight Claude call summarizes the entire history into a structured JSON:

```json
{
  "tripGoal": "destination, duration, dates, budget",
  "userProfile": "origin, passport, interests, group, constraints",
  "conversationSummary": "what was discussed and recommended",
  "decisions": "what the user confirmed",
  "pendingQuestions": "what the assistant last asked"
}
```

The summary replaces full history in the session store. Long conversations stay efficient without losing context.

### 8. Session-Level UserContext

Every message runs a parallel lightweight Claude call that extracts traveler profile fields:

| Field | Why it matters |
|---|---|
| `destination` | Extracted from any travel query, not just direct statements |
| `origin` | Affects flights, climate transition, power adapters |
| `passport` | Array — traveler may hold multiple. Determines visa access, entry restrictions |
| `interests` | Shapes every recommendation |
| `travelStyle` | Budget/mid-range/luxury changes everything |
| `tripDuration` | Affects packing, itinerary density |
| `travelGroup` | Solo vs family vs couple changes accommodation and activities |
| `budget` | Buy-there vs bring-from-home decisions, accommodation tier |
| `travelerConstraints` | Accessibility, dietary, medical — affects destination suitability |

The profile accumulates across the session. Passport is an array (Israeli + American → use most advantageous). "None" or negation values are automatically rejected and not stored.

The extractor receives the **last assistant message** as context — so when the agent asks "Where are you flying from?" and the user answers "Ramat Gan", it correctly extracts `origin: Ramat Gan` instead of overwriting `destination`.

### 9. Parallel Execution

Two layers of concurrency eliminate serial API bottlenecks:
- **Within a Travel Agent response**: all tool calls fire via `Promise.all` — a 3×3 destination query (9 API calls) runs in ~1-2 seconds instead of ~9 sequential calls
- **Supervisors**: Response Supervisor starts optimistically in parallel with the Travel Agent. If PASS — both results ready simultaneously. If REFINE — one extra call, not two serial ones.

---

## Installation

### Prerequisites

| Requirement | Source |
|---|---|
| Node.js 18+ | [nodejs.org](https://nodejs.org) |
| Anthropic API key | [console.anthropic.com](https://console.anthropic.com) |
| OpenWeatherMap API key | [openweathermap.org/api](https://openweathermap.org/api) — free tier |
| OpenTripMap API key | [opentripmap.org](https://opentripmap.org) — free tier |
| VoyageAI API key | [voyageai.com](https://www.voyageai.com) — free tier |

### Step 1 — Clone and Install

```bash
git clone <repo-url>
cd travel-assistant

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### Step 2 — Configure Environment

Create `server/.env`:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...
OPENWEATHER_API_KEY=your_key_here
OPENTRIPMAP_API_KEY=your_key_here
VOYAGEAI_API_KEY=your_key_here

# Model (Haiku = fast/cheap, Sonnet = higher quality)
CLAUDE_MODEL=claude-haiku-4-5-20251001

# Server port (optional, default 3001)
PORT=3001
```

### Step 3 — Run

Open two terminals:

```bash
# Terminal 1 — Start server
cd server && npm run dev

# Terminal 2 — Start client
cd client && npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)**

> The RAG knowledge base (`server/data/kb.jsonl`) is pre-built and included — no rebuild needed.

### Step 4 — Try It

Sample queries to explore the system:
- `"Where should I go in August for beaches? I'm from Israel with 10K ILS"`
- `"What to pack for a week in Iceland in winter?"`
- `"Plan a 2-week trip to Paris from Tel Aviv, mid-range budget"`
- `"What's up in Bali right now?"`
- `"Best local food spots in Tokyo?"`

---

## UI Features

Every assistant response shows full pipeline transparency:

- **Blue source tags** — which data sources powered the response (Claude, OpenWeatherMap, Web Search, etc.)
- **White tool tags** — which API tools were called
- **Yellow chain-of-thought tags** — which reasoning tools fired (explore_destination, think_packing_advice, etc.)
- **Supervisor badges** — each supervisor's verdict (PASS / REFINED / CLARIFY / SKIPPED)
- **Traveler profile bar** — accumulated session profile (destination ✈, origin, passport 🛂, budget, interests, group)
- **Clarification bubble** — distinct styled message with ⚠ when CLARIFY triggers
- **Thinking time** — response generation time shown per message

Server terminal shows structured color-coded logs with full pipeline visibility — draft response, tool calls, supervisor reasoning, and cache hits.

---

## Supported Query Types

| Query Type | Example | Tools Fired |
|---|---|---|
| Destination discovery | "Where should I go for beaches in August?" | explore_destination → 3×(get_country_info + get_weather + get_attractions) + search_travel_kb + web_search |
| Attraction exploration | "What should I see and do?" | explore_attractions → get_attractions ×3 + search_travel_kb + web_search |
| Packing advice | "What to pack for Iceland in winter?" | think_packing_advice → get_weather + get_exchange_rate + search_travel_kb + web_search |
| Full trip plan | "Plan 2 weeks in Paris from Tel Aviv, 10K ILS" | explore_trip → all API tools + search_travel_kb + web_search |
| Live weather | "What's the weather in Bangkok?" | get_weather |
| Country info | "Tell me about Japan" | get_country_info + search_travel_kb |
| Current events | "What's up in Bali right now?" | get_weather + get_attractions + search_travel_kb + web_search |
| Exchange rates | "How far does my budget go in Thailand?" | get_exchange_rate |
| Ambiguous query | "Explore Paris" | → CLARIFY: specific question naming the options |
| Unsafe destination | "I want to go to North Korea" | Handled via knowledge — redirects with alternatives |

---

## Project Structure

```
travel-assistant/
├── server/
│   ├── src/
│   │   ├── index.ts                    Entry point
│   │   ├── app.ts                      Express app (testable without starting server)
│   │   ├── shared/
│   │   │   ├── enums.ts                Role, Verdict, DataSource, DataType, SupervisorVerdict
│   │   │   ├── constants.ts            All magic numbers as named constants
│   │   │   └── types.ts                Message, Role
│   │   ├── modules/
│   │   │   ├── chat/                   HTTP boundary — router + handler
│   │   │   ├── pipeline/               Orchestration — full pipeline flow
│   │   │   ├── supervisor/
│   │   │   │   ├── supervisors/
│   │   │   │   │   ├── intent.ts       Pre-flight supervisor
│   │   │   │   │   ├── data.ts         Data relevance validator
│   │   │   │   │   └── response.ts     Response quality gate
│   │   │   │   ├── guards.ts           Type guards + verdict parser
│   │   │   │   └── types.ts            SupervisorResult, runWithRetry
│   │   │   ├── tools/
│   │   │   │   ├── definitions/
│   │   │   │   │   ├── api/            get_weather, get_country_info, get_attractions, get_exchange_rate
│   │   │   │   │   ├── chain_of_thought/ explore_destination, explore_attractions, think_packing_advice, explore_trip
│   │   │   │   │   ├── rag/            search_travel_kb
│   │   │   │   │   └── claude/         web_search
│   │   │   │   ├── executor.ts         Tool execution + cache + Data Supervisor
│   │   │   │   └── types.ts            ToolExecutionResult
│   │   │   ├── rag/
│   │   │   │   ├── handler/            loader, search, embedder
│   │   │   │   └── types.ts            KBDoc
│   │   │   ├── api/
│   │   │   │   └── apis/               weather, countries, attractions, exchangeRate clients
│   │   │   ├── llm/                    ClaudeProvider — tool loop, web search, cache
│   │   │   ├── session/                sessionStore, userContext extractor, types
│   │   │   └── compaction/             History compaction logic
│   │   ├── prompts/
│   │   │   ├── system.ts               Main travel agent system prompt
│   │   │   └── compaction.ts           Compaction summary prompt
│   │   └── utils/logger.ts             Structured color-coded terminal logging
│   ├── data/kb.jsonl                   Pre-built RAG knowledge base (322 docs)
│   └── scripts/buildKb.ts              Offline KB build script (VoyageAI embeddings)
├── client/src/
│   ├── App.tsx                         Chat UI — markdown, tables, source badges
│   ├── hooks/useChat.ts                State, session persistence, 30-min TTL
│   └── api/client.ts                   HTTP client
└── transcripts/                        Sample conversation transcripts
```

---

## Running Tests

```bash
# Server tests (59 tests)
cd server && npm test

# Client tests (29 tests)
cd client && npm test
```

---

## Key Design Decisions

See [`Key Decisions`](docs/) for the full record of 50+ architectural decisions made during development — including decisions where the original approach was overridden and why.

Highlights:
- **LLM-driven tool use** replaced a rule-based intent classifier — Claude evaluates context and decides which tools to call
- **CLARIFY verdict** added as a third supervisor outcome — not just PASS/REFINE, but proactive disambiguation
- **Pre-flight supervisor** runs before tools fire — prevents wasteful API calls when context is insufficient
- **Tool cache** tied to session TTL — single source of truth for cache lifetime
- **History compaction** triggered at 40% of rate limit (80K chars) — prevents rate limit errors on long conversations
- **Response Supervisor retry uses `disableTools=true`** — prevents web search re-execution that floods input context
- **UserContext extractor receives last assistant message** — prevents "israeli" (answering "what passport?") from being extracted as `destination`
