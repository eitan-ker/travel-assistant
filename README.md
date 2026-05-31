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

Copy `.env.example` to `server/.env` and fill in your keys:

```bash
cp .env.example server/.env
```

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
The assistant is given a focused travel persona with explicit behavioral rules: be concise, ask clarifying questions when queries are vague, never hallucinate specific prices or visa requirements, and always acknowledge when it's using live data vs. general knowledge.

### 2. Chain-of-Thought for Destination Recommendations
When the intent router detects a destination recommendation query, a chain-of-thought prompt is injected guiding Claude to reason step by step: budget → travel season → interests → destination match → why it fits. This produces structured, reasoned recommendations instead of flat lists.

### 3. Data Injection
When external APIs are called, results are injected into the prompt as a clearly labeled context block:
```
[Live Data]
Weather in Tokyo: 22°C, partly cloudy, humidity 68%
Use this real-time data to inform your response.
```
This pattern keeps the LLM grounded and prevents it from contradicting live data with training knowledge.

### 4. Intent Router — When to use external data vs. LLM knowledge
Rule-based keyword classifier decides per message:

| Pattern | Action |
|---|---|
| "weather in X", "temperature in X" | Fetch OpenWeatherMap |
| "tell me about X country", "what currency in X" | Fetch RestCountries |
| "best time to visit", "packing list", "what to see" | Claude knowledge only |
| "recommend a destination" | Claude knowledge + chain-of-thought prompt |

### 5. Supervisor Agent (Phase 3)
A second Claude call reviews each response before it reaches the user, checking for hallucinations, off-topic answers, and verbosity. If flagged, the response is re-prompted with corrective guidance.

### 6. Source Transparency
Every assistant response includes a `sources` tag in the UI showing what powered it — `Claude`, `Claude + OpenWeatherMap`, etc. This makes the data augmentation decision visible and auditable.

---

## Query Types Supported

- **Destination recommendations** — with chain-of-thought reasoning
- **Packing advice** — tailored by destination + season
- **Local attractions** — what to see and do
- **Live weather** — current conditions via OpenWeatherMap
- **Country info** — capital, currency, language, region via RestCountries

## Project Structure

```
travel-assistant/
├── server/
│   └── src/
│       ├── index.ts              Express app
│       ├── routes/chat.ts        POST /chat endpoint
│       ├── session/store.ts      In-memory session store
│       ├── llm/
│       │   ├── provider.ts       LLMProvider interface
│       │   ├── claude.ts         Claude provider (Anthropic SDK)
│       │   └── factory.ts        Provider factory
│       └── apis/
│           ├── weather.ts        OpenWeatherMap client
│           └── countries.ts      RestCountries client
└── client/
    └── src/
        ├── App.tsx               Chat UI
        ├── hooks/useChat.ts      State, localStorage persistence, console logging
        └── api/client.ts         HTTP client
```
