# Travel Assistant

A conversational travel planning assistant powered by Claude, with live weather and country data augmentation.

## Architecture

```
Browser (React + Vite)
  └── POST /chat { message, sessionId }
        └── Express Server (Node.js + TypeScript)
              ├── Intent Router      — classifies query, decides if external data is needed
              ├── Context Builder    — assembles system prompt + history + external data
              ├── External APIs
              │     ├── OpenWeatherMap  — live weather for any city
              │     └── RestCountries   — country info (capital, currency, language)
              └── Claude (claude-haiku-4-5-20251001)
```

**Session management:** conversation history is kept in-memory on the server per `sessionId`. The client persists `sessionId` + messages in `localStorage` with a 15-minute TTL — refreshing the page restores the conversation seamlessly.

## Setup

### Prerequisites
- Node.js 18+
- Anthropic API key — [console.anthropic.com](https://console.anthropic.com)
- OpenWeatherMap API key — [openweathermap.org/api](https://openweathermap.org/api) (free tier)

### Install

```bash
# Server
cd server && npm install

# Client
cd client && npm install
```

### Configure

Create `server/.env` with your keys:

```env
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-haiku-4-5-20251001
OPENWEATHER_API_KEY=your_key_here
PORT=3001
```

### Run

```bash
# Terminal 1 — server (auto-restarts on file changes)
cd server && npm run dev

# Terminal 2 — client
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Prompt Engineering Decisions

### 1. System Prompt
Every request includes a focused travel assistant persona with explicit behavioral rules: be concise, ask clarifying questions when queries are vague, never hallucinate specific prices or visa requirements, and always acknowledge when using live data vs. general knowledge.

### 2. Chain-of-Thought for Destination Recommendations
When the intent router detects a destination recommendation query, a chain-of-thought prompt is injected guiding Claude to reason step by step:
> Budget → Travel season → Interests → Destination shortlist → Top pick with reasoning

This produces structured, reasoned recommendations instead of generic flat lists.

### 3. Data Injection
When external APIs are called, results are injected into the system prompt as a clearly labeled context block:
```
[Live Data — OpenWeatherMap]
City: Tokyo, JP
Temperature: 22°C (feels like 21°C)
Conditions: partly cloudy
Use this real-time data to inform your response.
```
This grounds the LLM in real data and prevents it from contradicting live conditions with stale training knowledge.

### 4. Intent Router — When to use external data vs. LLM knowledge
Rule-based keyword classifier runs on every message before the LLM is called:

| Pattern | Action |
|---|---|
| "weather in X", "temperature in X", "is it hot in X" | Fetch OpenWeatherMap |
| "tell me about X", "currency in X", "info on X country" | Fetch RestCountries |
| "best time to visit", "packing list for X" | Claude knowledge only |
| "where should I go", "recommend a destination" | Claude knowledge + chain-of-thought |
| "what to see in X", "local food in X" | Claude knowledge only |

### 5. Source Transparency
Every assistant response includes a `sources` badge in the UI showing what powered it — `Claude`, `Claude + OpenWeatherMap`, or `Claude + RestCountries`. Makes the data augmentation decision visible and auditable.

### 6. Supervisor Agent *(Phase 3 — coming)*
A second Claude call will review each response before it reaches the user, checking for hallucinations, off-topic answers, and verbosity. If flagged, the response is re-prompted with corrective guidance.

---

## Query Types Supported

| Type | Example | Data Source |
|---|---|---|
| Destination recommendations | "Where should I go in Asia on a budget?" | Claude + CoT |
| Live weather | "What's the weather in Tokyo?" | Claude + OpenWeatherMap |
| Country info | "Tell me about Japan" | Claude + RestCountries |
| Packing advice | "What to pack for Iceland in winter?" | Claude |
| Local attractions | "Best things to do in Barcelona?" | Claude |
| General travel | "Do I need a visa for Thailand?" | Claude |

---

## Project Structure

```
travel-assistant/
├── server/
│   └── src/
│       ├── index.ts                 Express app
│       ├── routes/chat.ts           POST /chat endpoint
│       ├── session/store.ts         In-memory session store (15-min TTL on client)
│       ├── intent/router.ts         Keyword-based intent classifier
│       ├── context/builder.ts       Assembles prompt + fetches external data
│       ├── prompts/system.ts        System prompt + chain-of-thought prompt
│       ├── llm/
│       │   ├── provider.ts          LLMProvider interface
│       │   ├── claude.ts            Claude provider (Anthropic SDK)
│       │   └── factory.ts           Provider factory
│       └── apis/
│           ├── weather.ts           OpenWeatherMap client
│           └── countries.ts         RestCountries client
└── client/
    └── src/
        ├── App.tsx                  Chat UI
        ├── hooks/useChat.ts         State, localStorage persistence, console logging
        └── api/client.ts            HTTP client
```
