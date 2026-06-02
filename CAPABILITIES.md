# Travel Assistant — Capabilities & System Design

## What This Is

A production-grade travel planning assistant built on Claude. Not a chatbot wrapper — a multi-agent system with quality supervision, live data fusion, intelligent caching, and conversational memory. Every component was designed to solve a real problem that basic LLM wrappers fail at.

---

## Core Capabilities

**Destination Discovery** — Ask "where should I go?" with any combination of budget, interests, season, and travel style. The system reasons through 3 personalized matches, fetches live weather + attractions + country facts for each, and presents a comparison table. The traveler's passport filters out inaccessible destinations automatically.

**Full Trip Planning** — Provide a destination, origin, duration, and budget. Get a complete departure-to-return plan: visa situation, flights, where to stay, day-by-day itinerary, day trips, budget breakdown, packing essentials, and practical local tips — all grounded in live data.

**Packing Advice** — Ask about any destination and season. The system pulls current weather, considers the climate transition from your origin, checks entry requirements via web search, and gives a personalized list based on your activities, travel style, and duration.

**Local Attractions** — Discover what to see and do, matched to your interests and group. Returns 3 distinct area recommendations with live POI data, curated local knowledge, and current events.

**Live Data Queries** — Weather, exchange rates, country facts, current news and advisories — all from real APIs, not training data.

---

## Technical Innovations

### Pre-flight Intent Supervisor
Runs before any tool calls. Detects genuine ambiguity (e.g. "Paris" → France or Texas?) and asks the user directly — saving 12+ unnecessary API calls. Uses a two-step reasoning protocol: first checks if the user is answering a question (PASS), then checks for true place-name collision (CLARIFY).

### 3-Stage Quality Supervisor Pipeline
Three specialized agents, each owning one concern:
- **Data Supervisor** — validates every API result matches the query (catches wrong city, wrong country)
- **Response Supervisor** — catches hallucinations, unverified claims, verbosity, unanswered questions
- **Pre-flight** — context gate before tools fire

Each supervisor uses Claude's tool_use for structured verdicts — the model cannot deviate from the schema. Three verdicts: PASS, REFINE (retry with feedback), CLARIFY (ask user).

### Tool Result Cache
Successful API results are cached per session (30-min TTL, normalized keys). A destination recommendation fires 13+ API calls — follow-up questions about the same destinations cost zero API calls. Cache content is injected into the system prompt so Claude knows not to re-fetch.

### History Compaction
When conversation history exceeds 80,000 characters, a lightweight Claude call summarizes the entire history into a structured context block (trip goal, user profile, decisions made, pending questions). Long conversations stay efficient without losing context.

### RAG Knowledge Base
322 documents from WikiVoyage and Wikipedia covering 167 destinations. Embedded offline with VoyageAI and searched via cosine similarity at query time. Answers "what is this place like?" with stable cultural, historical, and practical knowledge — complementing live APIs that answer "what's happening right now?"

### Session UserContext
Every message extracts traveler profile fields in parallel (zero latency cost): destination, origin, passport (array — supports dual citizenship), budget, interests, travel style, duration, group, constraints. The profile accumulates across the conversation. The extractor receives the last assistant message to correctly interpret answers ("israeli" after "what passport?" = origin, not destination).

### Parallel Execution
All tool calls within a single response run concurrently via `Promise.all`. A 3×3 destination query (9 API calls) completes in ~1-2 seconds instead of ~9 sequential seconds.

### Data Transparency
Live API data (weather, exchange rates, attractions, country facts) is labeled as such. Training knowledge used for prices, visa details, and flight times is explicitly labeled "estimated — verify before booking." The Response Supervisor enforces this — it catches unqualified specific claims and triggers a rewrite.

---

## What the Evaluator Sees

Every response shows full pipeline transparency in the UI:
- Which data sources were used (color-coded source badges)
- Which tools fired (tool badges)  
- Which reasoning tools ran (chain-of-thought badges in yellow)
- Each supervisor's verdict (PASS / REFINED / CLARIFY)
- The accumulated traveler profile (profile bar at top)
- Response generation time

The server terminal shows structured color-coded logs with the full pipeline: draft response, tool calls, supervisor reasoning, cache hits.

---

## Supported APIs

| API | Purpose | Key Required |
|---|---|---|
| Anthropic Claude | LLM + web search | Yes |
| OpenWeatherMap | Live weather | Yes (free tier) |
| OpenTripMap | Live attractions | Yes (free tier) |
| RestCountries | Country facts | No |
| Frankfurter (ECB) | Exchange rates | No |
| VoyageAI | RAG embeddings | Yes (free tier) |

---

## Edge Cases Handled

- **Dangerous destinations** — Iran, North Korea, active conflict zones handled via knowledge with appropriate warnings and alternatives offered
- **Ambiguous place names** — Springfield, Georgia, Paris → CLARIFY with specific options
- **User answering questions** — "Israeli" after "what passport?" correctly extracted as nationality, not destination change
- **Rate limit protection** — history compaction at 40% of token limit prevents rate errors
- **API failures** — graceful fallback to LLM knowledge with clear labeling
- **Hallucinated specifics** — Response Supervisor catches unverified venue names, fake prices, invented schedules
