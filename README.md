# Travel Assistant

A conversational travel planning assistant powered by Claude, with live data augmentation, RAG knowledge base, real-time web search, and a multi-stage supervisor pipeline with PASS / REFINE / CLARIFY verdicts.

## Architecture

```
Browser (React + Vite)
  └── POST /chat { message, sessionId }
        └── Express Server (Node.js + TypeScript)
              └── Pipeline (modules/pipeline/index.ts)
                    ├── Travel Agent (Claude with 9 tools)
                    │     ├── API tools
                    │     │     ├── get_weather(city)            → OpenWeatherMap
                    │     │     ├── get_country_info(country)    → RestCountries
                    │     │     ├── get_attractions(city)        → OpenTripMap
                    │     │     ├── get_exchange_rate(from, to)  → Frankfurter (ECB)
                    │     │     └── search_travel_kb(query)      → RAG (322 docs, VoyageAI embeddings)
                    │     ├── Reasoning tools (chain-of-thought)
                    │     │     ├── think_destination_recommendation
                    │     │     ├── think_packing_advice
                    │     │     ├── think_local_attractions
                    │     │     └── think_trip_plan
                    │     └── Web search (Anthropic built-in)
                    │           └── web_search → live internet, news, advisories
                    └── Supervisor Pipeline
                          ├── Data Supervisor     — validates API data, PASS/REFINE/CLARIFY
                          ├── Intent Supervisor   — audits tool selection, PASS/REFINE/CLARIFY
                          └── Response Supervisor — quality gate, PASS/REFINE
```

## Prompt Engineering

### 1. LLM-driven Tool Use — Claude IS the Decision Method
Claude receives 9 tools and decides autonomously when to call them. The system prompt defines explicit decision criteria:
- Live data that changes → call an API tool
- Domain knowledge that doesn't change → use Claude's knowledge
- Both relevant → call the tool AND use knowledge together

This replaces a rule-based intent classifier — Claude is the decision engine.

### 2. Reasoning Tools as Chain-of-Thought
Reasoning tools guide Claude through structured thinking before responding:

**`think_destination_recommendation`** — budget → season → interests → 3-destination shortlist → top pick.
Then for EACH of the 3 shortlisted destinations, Claude calls `get_country_info`, `get_weather`, and `get_attractions` to ground every recommendation in live data (3×3 = 9 API calls per recommendation query).

**`think_packing_advice`** — climate → trip length → activities → essentials → nice-to-have

**`think_local_attractions`** — travel style → neighborhoods → must-sees → hidden gems → food & culture

**`think_trip_plan`** — the full trip planner. When destination, origin, duration, and budget are known: visa situation → getting there → accommodation → week-by-week itinerary → day trips → budget breakdown → practical tips. Always paired with `get_weather`, `get_country_info`, `get_attractions`, and `get_exchange_rate`.

### 3. 3-Stage Supervisor Pipeline with CLARIFY
Each supervisor owns one concern, uses Claude tool use for forced structured output:

| Supervisor | When | Checks | Verdicts |
|---|---|---|---|
| Data Supervisor | After each API tool call | Was the right data fetched? | PASS / REFINE / CLARIFY |
| Intent Supervisor | After Travel Agent | Did Claude call the right tools? | PASS / REFINE / CLARIFY |
| Response Supervisor | Always | Hallucination, verbosity, unanswered | PASS / REFINE |

**CLARIFY verdict:** When the query or fetched data is genuinely ambiguous (e.g. "Paris" could be France or Texas), the supervisor returns CLARIFY with a targeted question instead of guessing. The pipeline short-circuits — skips response generation and returns the question directly to the user. This is the correct state-of-the-art approach for a travel assistant where getting the destination wrong is a costly error.

**Supervisor robustness:** Each supervisor retries up to 3 times if it returns a verdict without reasoning. Falls back to PASS on 3rd failure.

### 4. RAG Knowledge Base
322 documents (WikiVoyage + Wikipedia) embedded with VoyageAI (`voyage-3-lite`) and stored as JSONL. `search_travel_kb` retrieves the top-3 most relevant docs via cosine similarity at query time. Called for every destination-specific query to enrich responses with curated local knowledge — complements live API data, never replaces it.

### 5. Web Search (Anthropic Built-in)
`web_search` is an Anthropic server-side tool — no external API key needed. Called for any destination-specific query to fetch recent news, travel advisories, entry requirement changes, and current events. Results are interleaved as `web_search_tool_result` blocks in Claude's response and detected at `end_turn` to correctly tag "Web Search" as a source.

### 6. Session-Level User Context
Every message runs a lightweight Claude call in parallel with the Travel Agent to extract user profile fields: destination, origin, passport, budget, travel style, duration, group, constraints. Stored per session and injected into every subsequent system prompt as a `[User Profile]` block. Claude personalizes all responses to the specific traveler without being asked twice.

The `destination` field overwrites on change — if the user switches from Tokyo to Bali, context updates automatically. The `passport` field enables implicit constraint checking (e.g. detecting that an Israeli passport holder cannot enter Iran).

### 7. Session Context Injected into Supervisors
The Intent Supervisor receives the current session UserContext alongside the user message. This prevents false CLARIFY verdicts on follow-up queries — "what's the weather there?" is not ambiguous when the context shows `destination: Tokyo, Japan`.

### 8. Parallelization
Two layers of parallel execution:
- **Tool calls** — all tools within a single Claude response fire via `Promise.all`. A 3×3 destination query (9 API calls) runs in ~1-2 seconds instead of ~5-9 sequentially.
- **Supervisors** — Intent + Response Supervisors start in parallel after Travel Agent completes. On the happy path, both results are ready simultaneously. On Intent REFINE, the optimistic Response result is discarded and re-run on the retried reply.

### 9. Response Retry Without Tools
When Response Supervisor REFINEs, the retry call passes `disableTools = true` — Claude rewrites using context already in the conversation, without re-running expensive tool calls (especially web search which returns large result blocks that can flood the input context).

## Setup

### Prerequisites
- Node.js 18+
- Anthropic API key — [console.anthropic.com](https://console.anthropic.com)
- OpenWeatherMap API key — [openweathermap.org/api](https://openweathermap.org/api) (free tier)
- OpenTripMap API key — [opentripmap.org](https://opentripmap.org) (free tier)
- VoyageAI API key — [voyageai.com](https://www.voyageai.com) (free tier, for RAG embeddings)

### Install

```bash
cd server && npm install
cd client && npm install
```

### Configure

Create `server/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-haiku-4-5-20251001
OPENWEATHER_API_KEY=your_key
OPENTRIPMAP_API_KEY=your_key
VOYAGEAI_API_KEY=your_key
PORT=3001
```

### Run

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

The RAG knowledge base (`server/data/kb.jsonl`) is pre-built and included. No need to rebuild.

## UI Features

Every assistant response shows:
- **Blue tags** — data sources (Claude, OpenWeatherMap, RestCountries, OpenTripMap, Frankfurter, Knowledge Base, Web Search)
- **White tags** — API tools called (get weather, get attractions, web search, etc.)
- **Yellow tags** — chain-of-thought reasoning tools used (think destination recommendation, etc.)
- **Supervisor list** — each supervisor's verdict per line (PASS / REFINED / SKIPPED / CLARIFY)
- **Traveler profile bar** — accumulated user context (destination, origin, passport, budget, interests)
- **Clarification bubble** — distinct styled message when CLARIFY is triggered, with ⚠ indicator

Server terminal shows structured color-coded logs per request — full pipeline visibility including draft response, tool calls, and supervisor reasoning with verdicts.

## Query Types

| Type | Example | Tools Used |
|---|---|---|
| Destination recommendation | "Where should I go in August for beaches?" | think_destination_recommendation + 3×(get_country_info + get_weather + get_attractions) + search_travel_kb + web_search |
| Live weather | "What's the weather in Tokyo right now?" | get_weather |
| Country info | "Tell me about Japan" | get_country_info + search_travel_kb |
| Packing advice | "What to pack for Iceland in winter?" | think_packing_advice + get_weather |
| Local attractions | "Best things to do in Barcelona?" | get_attractions + think_local_attractions + search_travel_kb |
| Current news | "What's up in Bali?" | get_weather + get_attractions + search_travel_kb + web_search |
| Exchange rate | "How far does $5k go in Japan?" | get_exchange_rate |
| Full trip plan | "Plan 2 weeks in Paris from Israel, $10k budget" | think_trip_plan + get_weather + get_country_info + get_attractions + get_exchange_rate + search_travel_kb + web_search |
| Ambiguous query | "What's the weather in Paris?" | → CLARIFY: "Did you mean Paris, France or Paris, Texas?" |

## Project Structure

```
travel-assistant/
├── server/src/
│   ├── index.ts                         Express app entry point
│   ├── shared/types.ts                  Cross-cutting types (Message, Role)
│   ├── modules/
│   │   ├── chat/
│   │   │   ├── index.ts                 Router
│   │   │   ├── handler.ts               Request/response logic
│   │   │   └── types.ts
│   │   ├── pipeline/
│   │   │   ├── index.ts                 Orchestration: Travel Agent → Supervisors
│   │   │   └── types.ts                 PipelineResult, SupervisorLog
│   │   ├── supervisor/
│   │   │   ├── intent.ts                Tool selection auditor
│   │   │   ├── data.ts                  Data relevance validator
│   │   │   ├── response.ts              Response quality gate
│   │   │   └── types.ts                 Verdict, SupervisorResult, runWithRetry
│   │   ├── tools/
│   │   │   ├── definitions.ts           9 tool definitions
│   │   │   ├── executor.ts              Tool execution + Data Supervisor integration
│   │   │   └── types.ts                 ToolExecutionResult
│   │   ├── rag/
│   │   │   ├── loader.ts                Load kb.jsonl into memory
│   │   │   ├── search.ts                Cosine similarity search
│   │   │   ├── embedder.ts              VoyageAI embedding client
│   │   │   ├── destinations.ts          List of 167 destinations for KB build
│   │   │   └── types.ts                 KBDoc
│   │   ├── integrations/
│   │   │   ├── weather.ts               OpenWeatherMap client
│   │   │   ├── countries.ts             RestCountries client
│   │   │   ├── attractions.ts           OpenTripMap client
│   │   │   └── exchangeRate.ts          Frankfurter (ECB) client
│   │   ├── llm/
│   │   │   ├── claude.ts                Tool use loop, web search detection, source tracking
│   │   │   ├── factory.ts               Provider factory
│   │   │   └── types.ts                 LLMProvider interface
│   │   └── session/
│   │       ├── store.ts                 In-memory session store
│   │       ├── userContext.ts           Context extractor + formatter
│   │       └── types.ts                 UserContext schema
│   ├── prompts/
│   │   ├── system.ts                    Main travel assistant system prompt
│   │   ├── intentSupervisor.ts          Intent supervisor prompt
│   │   ├── dataSupervisor.ts            Data supervisor prompt
│   │   ├── responseSupervisor.ts        Response supervisor prompt
│   │   └── userContext.ts               User context extraction prompt
│   └── utils/logger.ts                  Structured color-coded terminal logging
├── server/data/kb.jsonl                 Pre-built RAG knowledge base (322 docs)
└── client/src/
    ├── App.tsx                          Chat UI with markdown + table rendering
    ├── hooks/useChat.ts                 State + localStorage persistence (15-min TTL)
    └── api/client.ts                    HTTP client
```
