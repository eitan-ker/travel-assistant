# Key Engineering Decisions

This document explains the most significant decisions made in building this system — what was built, why it was built that way, and what problem it solves. Organized by theme.

---

## Prompt Engineering

### Schemas as Anti-Hallucination

The chain-of-thought tools (`explore_destination`, `think_packing_advice`, etc.) use structured tool schemas where key output fields are **required**. Claude cannot call the tool without committing to specific values — `destination_1`, `destination_2`, `destination_3` must all be filled before the tool call completes.

This is a fundamentally different approach from asking Claude to "recommend 3 destinations" in free-form text. With a schema, vague or hallucinated output fails the schema validation before it reaches the user. The schema is a reasoning guardrail, not just documentation.

The same pattern applies to supervisors — the `reasoning` field is required on every verdict. A REFINE without an explanation of why is untrustworthy. The schema enforces that the model must articulate its reasoning before committing to a verdict.

### Tool Descriptions as Decision Prompts

Each tool has explicit `Call when:` / `Do NOT call when:` instructions in its description. These are not comments — they are the actual decision method for when Claude invokes each tool. Claude reads them and decides autonomously. This replaces a rule-based intent classifier entirely, and handles multi-intent queries naturally ("should I pack an umbrella for Tokyo?" correctly triggers both `think_packing_advice` and `get_weather`).

### Chain-of-Thought as Explicit Tool Calls

Chain-of-thought reasoning is implemented as Claude tool calls, not hidden system prompt injections. When Claude calls `explore_destination`, the tool schema fields ARE the reasoning steps — budget, interests, travel style → shortlist → top pick. The reasoning is auditable in the logs and visible in the UI as yellow badges. Claude cannot skip steps.

### Two-Layer Cache Awareness

The tool result cache prevents redundant API calls at the code level. But the cache state is also injected into the system prompt as an `[Already fetched this session]` block. This means Claude is aware of what was already retrieved and won't even suggest re-fetching — behavioral reinforcement on top of the technical enforcement.

### Supervisor Context Isolation

Each supervisor receives only the context it needs for its specific job — nothing more. The Data Supervisor gets the raw API result and the user's query. The Response Supervisor gets the final response and recent conversation history. Neither gets the other's context. This prevents contamination and keeps each supervisor focused on one concern.

---

## Correctness

### Three-Verdict Supervisor System: PASS / REFINE / CLARIFY

Most systems have two states: good or retry. This system has three:

- **PASS** — acceptable, move forward
- **REFINE** — issue detected, retry with specific feedback
- **CLARIFY** — genuine ambiguity that cannot be resolved by retrying — ask the user

CLARIFY is the key insight. When a destination is ambiguous (Paris, France vs. Paris, Texas), retrying the same query produces the same problem. The pipeline short-circuits, returns a targeted question to the user, and zero tools fire. This is the correct behavior — guessing would be worse than asking.

### Pre-flight Supervisor with Two-Step Reasoning

The pre-flight supervisor runs before any tools fire, using a strict two-step protocol:

1. **Did the agent just ask a question?** If yes, the user is answering it — PASS immediately. This prevents a nationality answer ("Israeli") from being flagged as an ambiguous destination.
2. **Is there a genuine place-name collision?** Only then — CLARIFY with specific options.

This ordering matters. Without step 1, the system would CLARIFY on answers to its own questions, which is what was happening before this was added.

### UserContext Extractor Receives Last Assistant Message

The user context extraction call receives the last assistant message alongside the user's message. Without this, "Israeli" gets extracted as `destination: Israel` — overwriting Paris. With it, the extractor knows the agent asked "What's your passport?" and correctly extracts `passport: Israeli`. Every component that interprets user intent should know what was asked in the preceding turn.

### Negation Filtering in UserContext

If a user says "no constraints" or "none", the extractor could store `travelerConstraints: "none"` — a string that looks like data but means the absence of data. The merge logic explicitly rejects negation values and leaves the field undefined. Small bug, real impact on downstream recommendations.

### Response Supervisor Receives Verified Source List

The Response Supervisor knows which facts in the response came from live APIs (weather, exchange rates, country data). It won't flag "27°C, 67% humidity" as a hallucination when it knows that came from OpenWeatherMap. Without this, the supervisor would REFINE correct responses for containing specific numbers.

### Supervisor Retry on Empty Reasoning

Each supervisor retries up to 3 times specifically when the reasoning field is empty. An empty reasoning field is the failure mode that makes a verdict unsafe to act on — REFINE without explanation is meaningless feedback. After 3 failures, it falls back to PASS. Conservative by design: better to let a response through than to act on an unexplained verdict.

---

## Efficiency

### Pre-flight Catches Insufficient Context Before Tools Fire

The original post-flight Intent Supervisor reviewed tool selection after tools had already fired. On a 3×3 destination query (13 API calls), a REFINE verdict meant re-running everything — 26 API calls for one response. The pre-flight check runs in ~2 seconds and prevents all those calls when context is insufficient.

### Tool Result Cache with Normalized Keys

Successful API results are cached within the session. Cache keys are normalized — `"Bali, Indonesia"` and `"Bali"` hit the same key. On a destination recommendation with follow-up questions about the same destinations, the second request costs zero API calls. The cache TTL matches the session TTL — one expiry to manage, not two.

### Parallel Tool Execution

All tool calls within a single response execute concurrently via `Promise.all`. A 3×3 destination recommendation fires 9 API calls simultaneously instead of sequentially — completing in 1-2 seconds instead of 9+. Tools within the same response are independent, so there's no correctness cost to parallelism.

### History Compaction at 40% of Rate Limit

Long conversations accumulate tool results, web search data, and full responses. Without compaction, later messages hit the API rate limit. The compaction threshold is set at 80,000 characters — 40% of the rate limit — leaving headroom for the current request's own tool calls. The compaction output is a typed schema (trip goal, user profile, decisions, pending questions), not free-form text — guaranteeing the summary always contains exactly what future requests need.

### Response Supervisor Retry Disables Tools

When the Response Supervisor triggers a retry, the retry call passes `disableTools=true`. Without this, the retry re-runs all tools including web search, which returns large result blocks that flood the input context. Each retry would be shorter and worse than the last — a degradation spiral. With `disableTools=true`, Claude rewrites using context already in the conversation.

### Supervisor Token Budgets Kept Small

Each supervisor has a small max_tokens budget (256–512). Supervisors produce verdicts with reasoning — they don't need space for a full travel response. Keeping these small reduces latency and cost across 3 supervisor calls per request. This adds up.

### RAG Built from Summaries, Not Raw Text

During offline build, Claude summarizes each WikiVoyage and Wikipedia article before embedding. Raw Wikipedia contains markup, tables, and formatting noise. Claude-generated summaries are semantically dense — the embedding space represents meaning, not formatting artifacts. Better embeddings mean better retrieval.

### Pre-built Knowledge Base Shipped in the Package

The RAG knowledge base (`kb.jsonl`, 322 documents) is built offline and included. The embedding cost was paid once during development, not at runtime. The evaluator does not need a VoyageAI key to run the system — only to rebuild the KB from scratch, which is not required.

---

## Architecture

### Modular Design for Microservice Readiness

Code is organized into domain modules (chat, pipeline, supervisor, tools, rag, api, llm, session, compaction) rather than technical layers. Each module exposes only an `index.ts` as its public API — internal files are never imported from outside. When a module needs to become its own service, you wrap its `index.ts` in an HTTP server and swap the import for an HTTP call. Minimal friction.

### Schemas and Types Enforced by TypeScript

All supervisor verdicts, tool execution results, and user context fields are typed with TypeScript interfaces and enums. The `Verdict` enum prevents string typos from causing silent failures. The `UserContext` interface documents every field the system tracks. The `SupervisorLog` type enforces that UI badges always have a valid verdict string.

### Named Constants for All Thresholds

Every threshold in the system (`SESSION_DURATION_MINUTES`, `COMPACTION_THRESHOLD_CHARS`, `MAX_SUPERVISOR_RETRIES`, `KB_SEARCH_TOP_K`, etc.) is a named constant in `shared/constants.ts`. No magic numbers anywhere. If the rate limit changes or the session TTL needs adjusting, there is exactly one place to update it.
