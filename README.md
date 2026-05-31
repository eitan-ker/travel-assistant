# Travel Assistant

A conversational travel planning assistant powered by Claude, with live data augmentation and a multi-stage supervisor pipeline.

## Architecture

```
Browser (React + Vite)
  └── POST /chat { message, sessionId }
        └── Express Server (Node.js + TypeScript)
              └── Pipeline (context/builder.ts)
                    ├── Travel Agent (Claude with 6 tools)
                    │     ├── API tools (Claude calls when needed)
                    │     │     ├── get_weather(city)         → OpenWeatherMap
                    │     │     ├── get_country_info(country) → RestCountries
                    │     │     └── get_attractions(city)     → OpenTripMap
                    │     └── Reasoning tools (chain-of-thought, shown in yellow in UI)
                    │           ├── think_destination_recommendation
                    │           ├── think_packing_advice
                    │           └── think_local_attractions
                    └── Supervisor Pipeline
                          ├── Intent Supervisor   — audits tool selection
                          ├── Data Supervisor     — validates API data relevance
                          └── Response Supervisor — quality gate before sending
```

## Prompt Engineering

### 1. LLM-driven Tool Use — The Decision Method
Claude receives 6 tools and decides autonomously when to call them. The system prompt defines explicit decision criteria:
- Live data that changes → call an API tool
- Domain knowledge that doesn't change → use Claude's knowledge
- Both relevant → call the tool AND use knowledge together

This replaces a rule-based intent classifier — Claude IS the decision method.

### 2. Reasoning Tools as Chain-of-Thought
Reasoning tools guide Claude through structured thinking before responding:

**`think_destination_recommendation`** — budget → season → interests → 3-destination shortlist → top pick
Then for EACH of the 3 shortlisted destinations, Claude calls `get_country_info`, `get_weather`, and `get_attractions` to ground every recommendation in live data (3×3 = 9 API calls per recommendation query).

**`think_packing_advice`** — climate → trip length → activities → essentials → nice-to-have

**`think_local_attractions`** — travel style → neighborhoods → must-sees → hidden gems → food & culture

**`think_trip_plan`** — the full trip planner. When destination, origin, duration, and budget are known: visa situation → getting there → accommodation → week-by-week itinerary → day trips → budget breakdown → practical tips. Always paired with `get_weather`, `get_country_info`, and `get_attractions`.

### 3. 3-Stage Supervisor Pipeline
Each supervisor owns one concern, uses Claude tool use for forced structured output:

| Supervisor | When | Checks | On REFINE |
|---|---|---|---|
| Intent Supervisor | After Travel Agent | Did Claude call the right tools? | Re-run Travel Agent with correction |
| Data Supervisor | After API tool call | Was the right data fetched? | Drop data, use LLM knowledge |
| Response Supervisor | Always | Hallucination, verbosity, unanswered | Re-run Travel Agent with correction |

**Supervisor robustness:** Each supervisor retries up to 3 times if it returns a verdict without reasoning. Falls back to PASS on 3rd failure — a verdict without reasoning is untrustworthy.

### 4. Parallelization
Two layers of parallel execution to minimize latency:

- **Tool calls** — all tool calls within a single Claude response run via `Promise.all`. For a 3×3 destination query (9 API calls), these fire simultaneously instead of sequentially.
- **Supervisors** — Intent Supervisor and Response Supervisor start in parallel immediately after Travel Agent completes. On the happy path (~90% of requests), both results are ready at the same time. On Intent REFINE, the optimistic Response Supervisor result is discarded and re-run on the retried reply.

### 5. Context Management
- Full conversation history sent on every request (session store, in-memory per `sessionId`)
- Response Supervisor receives last 4 turns as prior context to avoid false positives on follow-up messages
- Response Supervisor receives verified live data sources so it doesn't flag real API data as hallucinations
- Each supervisor retry injects corrective guidance after the previous bad response

### 6. Response Schema
| Agent | Output | Schema |
|---|---|---|
| Travel Agent | Shown to user | Free-form text — natural language |
| Supervisors | Parsed by code | Tool use: `{ verdict, reasoning, feedback }` |

Tool use forces structured output — the model cannot deviate from the schema.

### 7. Off-topic Handling
If the user asks about politics, news, or anything unrelated to travel, the system prompt instructs Claude to decline in one professional sentence and redirect — no supervisor needed for this.

## Setup

### Prerequisites
- Node.js 18+
- Anthropic API key — [console.anthropic.com](https://console.anthropic.com)
- OpenWeatherMap API key — [openweathermap.org/api](https://openweathermap.org/api) (free tier)
- OpenTripMap API key — [opentripmap.org](https://opentripmap.org) (free tier)

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
OPENWEATHER_API_KEY=your_key_here
OPENTRIPMAP_API_KEY=your_key_here
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

## UI Features

Every assistant response shows:
- **Blue tags** — data sources (Claude, OpenWeatherMap, RestCountries, OpenTripMap)
- **Yellow tags** — chain-of-thought reasoning tools used (think destination recommendation, etc.)
- **Light blue tags** — API tools called (get weather, get attractions, etc.)
- **Supervisor list** — each supervisor's verdict per line (PASS / REFINED / SKIPPED)

Server terminal shows a structured log per request — full pipeline visibility including draft response before supervisors, tool calls, and supervisor reasoning.

## Query Types

| Type | Example | Tools Used |
|---|---|---|
| Destination recommendation | "Where should I go in August for beaches?" | think_destination_recommendation + get_country_info × 3 + get_weather × 3 + get_attractions × 3 |
| Live weather | "What's the weather in Tokyo?" | get_weather |
| Country info | "Tell me about Japan" | get_country_info |
| Packing advice | "What to pack for Iceland in winter?" | think_packing_advice |
| Local attractions | "Best things to do in Barcelona?" | get_attractions + think_local_attractions |
| Multi-intent | "Should I pack an umbrella for Tokyo?" | get_weather + think_packing_advice |
| Full trip plan | "I'm going to Netanya for 2 weeks, flying from Thailand, $10k budget" | think_trip_plan + get_weather + get_country_info + get_attractions |

## Project Structure

```
travel-assistant/
├── server/src/
│   ├── index.ts                    Express app
│   ├── routes/chat.ts              POST /chat endpoint
│   ├── session/store.ts            In-memory session store
│   ├── context/builder.ts          Pipeline orchestration
│   ├── prompts/system.ts           System prompt + tool philosophy
│   ├── llm/claude.ts               Claude provider with tool use loop
│   ├── tools/
│   │   ├── definitions.ts          7 tool definitions (3 API + 4 chain-of-thought)
│   │   └── executor.ts             Tool execution + Data Supervisor
│   ├── supervisor/
│   │   ├── types.ts                Shared types + runWithRetry (3 attempts)
│   │   ├── intentSupervisor.ts     Tool selection auditor
│   │   ├── dataSupervisor.ts       Data relevance validator
│   │   └── responseSupervisor.ts   Response quality gate
│   ├── apis/
│   │   ├── weather.ts              OpenWeatherMap client
│   │   ├── countries.ts            RestCountries client
│   │   └── attractions.ts          OpenTripMap client
│   └── utils/logger.ts             Structured terminal logging with color
└── client/src/
    ├── App.tsx                     Chat UI with markdown rendering
    ├── hooks/useChat.ts            State + localStorage persistence (15-min TTL)
    └── api/client.ts               HTTP client
```
