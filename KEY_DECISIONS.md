# Key Prompt Engineering & Architecture Decisions

This document records the most significant decisions made during development — including cases where the original approach was reconsidered and why. Each decision has a clear rationale and trade-offs acknowledged.

---

## 1. Claude as the Decision Engine (Not a Rule-Based Router)

**Decision:** Remove the keyword-based intent classifier. Give Claude all tools and let it decide autonomously when to call them.

**Why:** Rule-based routing is rigid — "should I pack an umbrella for Tokyo?" gets classified as `packing` and misses that it also needs live weather. Multi-intent queries are impossible to handle cleanly with rules. Claude evaluates context holistically and decides which tools add value.

**Trade-off:** Less deterministic than rules. Mitigated by the supervisor pipeline which audits tool selection and corrects mistakes.

---

## 2. Supervisors Use Tool Use for Structured Output (Not Prompt-Based JSON)

**Decision:** All supervisor verdicts are returned via Claude's tool_use, not free-form JSON instructions.

**Why:** Prompt-based JSON is fragile — Claude can wrap the output in prose, add commentary, or deviate from the format. Tool use forces the model into a schema it cannot escape. A REFINE verdict without reasoning is untrustworthy; the schema enforces that reasoning is always present.

---

## 3. Three-Stage Supervisor Architecture

**Decision:** Three specialist supervisors (pre-flight, data, response), each owning one concern — not a single general reviewer.

**Why:** A general reviewer needs more context, produces vaguer feedback, and is harder to tune. Separation of concerns applies to prompts as much as to code. Each supervisor is given minimal context for its specific job.

- **Pre-flight** — does the user have enough context to justify running tools?
- **Data** — did we fetch the right data for this query?
- **Response** — is the final response quality acceptable?

---

## 4. CLARIFY as a Third Verdict

**Decision:** Add CLARIFY alongside PASS and REFINE as a supervisor verdict that returns a question to the user and skips all tool execution.

**Why:** When a destination is genuinely ambiguous (Paris, France vs. Paris, Texas), REFINE is wrong — retrying with the same ambiguous query produces the same problem. CLARIFY short-circuits the pipeline before any tools fire, asks a targeted question, and saves 12+ API calls.

**Design:** The question field is required when CLARIFY is returned — the supervisor must name the specific competing options, never return a generic question.

---

## 5. Pre-flight Supervisor Runs Before Tools Fire

**Decision:** Add a dedicated pre-flight check that runs before the Travel Agent and any tool calls.

**Why:** The original Intent Supervisor ran post-flight — it reviewed tool selection after tools had already fired. When it triggered REFINE, the Travel Agent re-ran all tools again. On a 3×3 destination query (13 API calls), this doubled the cost. Pre-flight catches insufficient context before any tools run.

**Two-step reasoning protocol:**
1. Did the agent's last message ask a question? If yes → user is answering it → PASS immediately (prevents false ambiguity)
2. Is there a genuine place-name collision? → CLARIFY with specific options

---

## 6. Tool Result Cache Tied to Session TTL

**Decision:** Cache successful API call results within the session, keyed by tool name + normalized input. TTL matches the session lifetime (30 minutes).

**Why:** A destination recommendation fires 13+ API calls. If the user follows up about the same destinations, all those calls would re-fire. The cache prevents this. One TTL eliminates the need to manage a separate cache expiry.

**Normalization:** Cache keys are normalized (`"Bali, Indonesia"` and `"Bali"` hit the same key). Cache content is injected into the system prompt so Claude knows not to re-fetch.

---

## 7. History Compaction at 40% of Rate Limit

**Decision:** When conversation history exceeds 80,000 characters (~20,000 tokens), summarize the entire history into a structured context block before the next request.

**Why:** Long conversations accumulate tool results, web search data, and full responses. Without compaction, later messages hit the API rate limit. Triggering at 40% of the limit gives headroom for the current request's own tool calls.

**Schema:** The summary captures trip goal, user profile, decisions made, conversation summary, and pending questions — enough to continue naturally without the raw history.

---

## 8. Response Supervisor Retry Uses `disableTools=true`

**Decision:** When the Response Supervisor triggers a REFINE retry, the retry call disables all tools.

**Why:** Without this, the retry re-runs all tools including web search. Web search returns large result blocks that flood the input context, leaving little room for output. Each retry made responses shorter and worse — a degradation spiral. With `disableTools=true`, Claude rewrites using context already in the conversation.

---

## 9. UserContext Extractor Receives Last Assistant Message

**Decision:** Pass the last assistant message to the UserContext extraction call alongside the user's message.

**Why:** Without this context, the extractor sees "Israeli" in isolation and may extract it as `destination: Israel` — overwriting the actual destination. When the extractor knows the agent just asked "What's your passport nationality?", it correctly extracts `passport: Israeli` instead.

**Broader principle:** Every component that makes decisions about user intent should know what was asked in the preceding turn, not just what the user said.

---

## 10. RAG for Stable Knowledge, Web Search for Live Data

**Decision:** Two complementary data sources with different freshness profiles — RAG for stable knowledge, web search for current events.

**Why:** RAG (322 WikiVoyage + Wikipedia docs, VoyageAI embeddings) answers "what is this place like?" — cultural context, local customs, neighborhood character, historical significance. These don't change week-to-week. Web search answers "what's happening right now?" — advisories, current events, entry requirement changes. Running web search for stable facts wastes tokens and latency; using training knowledge for current events risks hallucination.

---

## 11. Parallel Tool Execution via Promise.all

**Decision:** All tool calls within a single Travel Agent response execute concurrently.

**Why:** A 3×3 destination recommendation query fires 9 API calls (weather × 3, country × 3, attractions × 3). Sequential execution would take 9+ seconds. Parallel execution completes in 1-2 seconds (limited by the slowest single call). Tools within the same response are independent — no ordering dependency.

---

## 12. Chain-of-Thought Tools as Explicit Tool Calls (Not Hidden Injections)

**Decision:** Chain-of-thought prompts implemented as explicit Claude tools (`explore_destination`, `think_packing_advice`, etc.) rather than hidden system prompt injections.

**Why:** As explicit tools, Claude signals which reasoning mode it's using — visible in logs and UI badges. The reasoning process is auditable. Claude can combine reasoning tools with API tools in the same response. The tool schema IS the chain-of-thought structure — each field is a reasoning step the model must complete before responding.

---

## 13. Session UserContext as Shared Memory

**Decision:** Extract traveler profile fields from every message and inject the accumulated profile into every subsequent system prompt.

**Why:** Without this, Claude has no memory of who it's talking to. With it, a user who mentioned "Israeli passport" three messages ago doesn't need to repeat themselves. The profile shapes every recommendation — passport affects visa filtering, origin affects flight advice, constraints affect destination suitability.

**Key detail:** Passport is an array — a traveler may hold multiple nationalities. "None" and negation values are automatically rejected and not stored.

---

## 14. Modular Architecture for Microservice Readiness

**Decision:** Organize code into `modules/` with domain boundaries (chat, pipeline, supervisor, tools, rag, api, llm, session, compaction) rather than layer-first folders.

**Why:** Domain-first organization means each module contains everything it needs. When extracting `supervisor` or `rag` to its own microservice, you wrap its `index.ts` in an HTTP server and swap the import for an HTTP call — minimal friction.

**Convention enforced:** Each module exposes only an `index.ts` as its public API. Internal files are never imported directly from outside the module.
