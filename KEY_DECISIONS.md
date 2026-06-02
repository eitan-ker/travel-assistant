# Key Prompt Engineering Decisions

Seven decisions that define how this system works — each solving a real problem in building a reliable, efficient travel assistant.

---

## 1. Supervisors as Quality Guards

A key weakness of LLM systems is that they can confidently produce wrong output — wrong data, hallucinated facts, or poor responses — with no internal signal that something went wrong. This system addresses that with three specialized supervisor agents, each owning one concern:

- **Pre-flight supervisor** — runs before any tools fire. Checks whether the query has enough context to proceed, and whether any place name is genuinely ambiguous. If ambiguous, asks the user directly instead of guessing. This prevents wasting 13+ API calls on a query that will produce the wrong result.

- **Data supervisor** — validates every API result before it reaches the Travel Agent. If the weather API returns data for the wrong city, or the attractions API returns irrelevant results, the supervisor rejects the data and the tool falls back to general knowledge. Bad data never reaches the response.

- **Response supervisor** — reviews the final response before it reaches the user. Catches hallucinated specific claims (invented venue names, unverified prices), unanswered questions, and off-topic responses. If the response fails, it triggers a rewrite with specific feedback.

Each supervisor uses Claude's tool_use for its verdict — the verdict schema is enforced, reasoning is required, and the model cannot deviate from the format. Three possible verdicts: **PASS** (acceptable), **REFINE** (retry with feedback), **CLARIFY** (genuine ambiguity — ask the user instead of guessing).

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

At query time, the search query is embedded and the top-3 most relevant documents are retrieved via cosine similarity. The knowledge base is pre-built and shipped with the system — no setup step, no embedding cost at runtime.

---

## 4. UserContext Agent — Persistent Session Memory

Every message triggers a lightweight Claude call that runs in parallel with the Travel Agent (zero latency cost) to extract traveler profile fields: destination, origin, passport, budget, travel style, trip duration, group composition, interests, and constraints.

The extracted profile accumulates across the session and is injected into every subsequent system prompt as a `[User Profile]` block. Claude always knows who it's talking to — a user who mentioned "Israeli passport" three messages ago doesn't need to repeat themselves. The profile shapes every recommendation silently.

This also serves as a cache. Once the system knows the traveler's origin, passport, and budget, those values are available to every tool and supervisor without additional API calls. API results (weather, attractions, country data) are also cached within the session — follow-up questions about the same destinations cost zero additional calls.

---

## 5. Schemas as Prompts — Structured Reasoning via Tool Schemas

The chain-of-thought reasoning tools (`explore_destination`, `think_packing_advice`, `explore_trip`, etc.) use Claude's tool_use with carefully designed schemas. The schema fields are not just documentation — they are the reasoning steps.

For `explore_destination`, Claude must fill in interests, passport, budget, travel style, origin, and group before committing to `destination_1`, `destination_2`, `destination_3`. It cannot call the tool with vague or incomplete reasoning — the `required` array enforces completeness. The schema is a hallucination guardrail: Claude commits to specific, structured values rather than producing free-form text that could be vague or fabricated.

The same principle applies to supervisors — the reasoning field is required on every verdict. A REFINE without an explanation of why is meaningless feedback. A CLARIFY without a specific question is useless. The schema enforces quality at the model output level.

---

## 6. Parallelism Where Possible

The system identifies two layers of parallelism and applies them consistently:

**Within a Travel Agent response:** All tool calls fire concurrently via `Promise.all`. A 3×3 destination recommendation fires 9 API calls simultaneously — completing in 1-2 seconds instead of 9+ sequential seconds. Tools within the same response are independent, so there is no correctness cost to running them in parallel.

**Across pipeline stages:** The UserContext extraction call runs in parallel with the Travel Agent — by the time the Travel Agent finishes, the updated user profile is already ready. The Response Supervisor also starts optimistically in parallel after the Travel Agent completes. On the happy path, both are ready simultaneously.

---

## 7. History Compaction

Long conversations accumulate tool results, web search data, and full responses. Without intervention, the conversation history grows until it hits the API rate limit — causing errors and slowing down later messages.

When the conversation history exceeds 80,000 characters (~40% of the API rate limit), the system triggers compaction. A lightweight Claude call summarizes the entire history into a structured schema:

- **Trip goal** — destination, duration, dates, budget
- **User profile** — origin, passport, interests, constraints
- **Conversation summary** — what was discussed and recommended
- **Decisions made** — what the user confirmed
- **Pending questions** — what the assistant last asked

The summary replaces the full history. Future requests stay well within the rate limit while retaining all meaningful context. The structured output guarantees that future requests always have exactly the fields they need.

