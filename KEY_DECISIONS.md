# Key Prompt Engineering Decisions

Seven decisions that define how this system works — each solving a real problem in building a reliable, efficient travel assistant.

---

## 1. Supervisors as Quality Guards

A key weakness of LLM systems is that they can confidently produce wrong output — wrong data, hallucinated facts, or poor responses — with no internal signal that something went wrong. This system addresses that with three specialized supervisor agents, each owning one concern:

- **Pre-flight supervisor** — runs before any tools fire. Checks whether the query has enough context to proceed, and whether any place name is genuinely ambiguous. If ambiguous, asks the user directly instead of guessing. This prevents wasting 13+ API calls and thousands of input tokens on a query that will produce the wrong result. Each supervisor is allocated a small max_tokens budget (256–512) — they produce structured verdicts, not full responses, so there is no reason to give them more.

- **Data supervisor** — validates every API result before it reaches the Travel Agent. If the weather API returns data for the wrong city, the supervisor rejects it and the tool falls back to general knowledge. Bad data never reaches the response — and bad data reaching the context wastes the tokens used to process it.

- **Response supervisor** — reviews the final response before it reaches the user. Catches hallucinated specific claims (invented venue names, unverified prices), unanswered questions, and off-topic responses. When it triggers a retry, the retry runs with `disableTools=true` — preventing web search from re-executing and flooding the context with large result blocks a second time.

Each supervisor uses Claude's tool_use for its verdict — the schema is enforced, reasoning is required, and the model cannot deviate. Three possible verdicts: **PASS** (acceptable), **REFINE** (retry with specific feedback), **CLARIFY** (genuine ambiguity — ask the user instead of guessing).

---

## 2. Live Real-Time Data via API Tools

For data that changes — weather conditions, exchange rates, attractions, country facts — the system fetches directly from live APIs at query time:

- **OpenWeatherMap** — current weather conditions
- **OpenTripMap** — live points of interest and attractions
- **RestCountries** — country facts, currency, language
- **Frankfurter (ECB)** — real-time exchange rates
- **Anthropic web search** — current news, advisories, entry requirements

Claude decides autonomously which tools to call based on explicit instructions in each tool's description. The decision method is part of the prompt — not a separate classifier. This approach handles multi-intent queries naturally: "should I pack an umbrella for Tokyo?" correctly triggers both packing reasoning and live weather in the same response.

---

## 3. RAG — Offline Processing for Stable Knowledge

Travel knowledge falls into two categories: things that change (weather, prices, current events) and things that don't (local culture, neighborhood character, historical context, customs). This system uses a dedicated knowledge base for the stable category.

322 WikiVoyage and Wikipedia articles covering 167 destinations were processed offline. Rather than embedding the raw source text — which contains markup, tables, and formatting noise — Claude first generates a clean summary of each article. The summaries are then embedded using VoyageAI `voyage-3-lite`. This means the vector space represents meaning, not formatting artifacts, resulting in significantly better retrieval quality.

At query time, the search query is embedded and the top-3 most relevant documents are retrieved via cosine similarity — no vector database required. The knowledge base is pre-built and shipped with the system — no setup step, no embedding cost at runtime. The full embedding cost was paid once during development.

---

## 4. UserContext Agent — Persistent Cached Session Memory

Every message triggers a lightweight Claude call that runs in parallel with the Travel Agent (zero latency cost) to extract traveler profile fields: destination, origin, passport, budget, travel style, trip duration, group composition, interests, and constraints.

The extracted profile accumulates across the session and is injected into every subsequent system prompt as a `[User Profile]` block. Claude always knows who it's talking to — a user who mentioned "Israeli passport" three messages ago doesn't need to repeat themselves. The profile shapes every recommendation silently, and injecting it once per request is cheaper than re-asking for context every time.

API results (weather, attractions, country data) are also cached within the session. Follow-up questions about the same destinations cost zero additional API calls. The cache state is also injected into the system prompt — Claude knows what was already fetched and doesn't suggest re-fetching, keeping the prompt shorter and the tool call count lower.

---

## 5. Schemas as Prompts — Structured Reasoning via Tool Schemas

The chain-of-thought reasoning tools (`explore_destination`, `think_packing_advice`, `explore_trip`, etc.) use Claude's tool_use with carefully designed schemas. The schema fields are not just documentation — they are the reasoning steps.

For `explore_destination`, Claude must fill in interests, passport, budget, travel style, origin, and group before committing to `destination_1`, `destination_2`, `destination_3`. It cannot call the tool with vague or incomplete reasoning — the `required` array enforces completeness. The schema is a hallucination guardrail: Claude commits to specific, structured values rather than producing free-form text that is harder to validate and tends to be longer and noisier.

The same principle applies to supervisors — the reasoning field is required on every verdict. Structured output is more token-efficient than free-form: a verdict with a defined schema produces a compact, parseable response. A REFINE without an explanation of why is meaningless feedback. The schema enforces quality and conciseness at the model output level.

---

## 6. Parallelism Where Possible

The system identifies two layers of parallelism and applies them consistently:

**Within a Travel Agent response:** All tool calls fire concurrently via `Promise.all`. A 3×3 destination recommendation fires 9 API calls simultaneously — completing in 1-2 seconds instead of 9+ sequential seconds. Tools within the same response are independent, so there is no correctness cost to running them in parallel.

**Across pipeline stages:** The UserContext extraction call runs in parallel with the Travel Agent — by the time the Travel Agent finishes, the updated user profile is already ready with zero added latency. The Response Supervisor also starts optimistically in parallel after the Travel Agent completes. On the happy path (the majority of requests), both results are ready simultaneously — saving one full serial LLM call per request.

---

## 7. History Compaction

Long conversations accumulate tool results, web search data, and full responses. Without intervention, every request sends the entire history — including large tool result blocks and web search content — as input tokens. Token cost grows exponentially with conversation length, and eventually the conversation hits the API rate limit entirely.

When the conversation history exceeds 80,000 characters (~40% of the API rate limit), the system triggers compaction. A lightweight Claude call summarizes the entire history into a structured schema:

- **Trip goal** — destination, duration, dates, budget
- **User profile** — origin, passport, interests, constraints
- **Conversation summary** — what was discussed and recommended
- **Decisions made** — what the user confirmed
- **Pending questions** — what the assistant last asked

The summary replaces the full history. Future requests send a few hundred tokens of context instead of tens of thousands — staying well within the rate limit and significantly reducing cost on long conversations. The structured schema guarantees that future requests always have exactly the fields they need, without the noise of the full raw history.
