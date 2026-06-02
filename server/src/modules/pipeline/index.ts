import { DataSource, Role, SupervisorVerdict, Verdict } from '../../shared/enums.js';
import { SYSTEM_PROMPT } from '../../prompts/system.js';
import { runResponseSupervisor } from '../supervisor/response.js';
import { runIntentSupervisor } from '../supervisor/intent.js';
import { getLLMProvider } from '../llm/factory.js';
import { ClaudeProvider } from '../llm/claude.js';
import { log } from '../../utils/logger.js';
import { extractUserContext, formatUserContext } from '../session/userContext.js';
import type { UserContext } from '../session/types.js';
import type { Message } from '../../shared/types.js';
import type { PipelineResult, SupervisorLog } from './types.js';

const LIVE_SOURCES = new Set<string>([
  DataSource.OpenWeatherMap,
  DataSource.RestCountries,
  DataSource.OpenTripMap,
  DataSource.Frankfurter,
  DataSource.KnowledgeBase,
  DataSource.WebSearch,
]);

export async function runPipeline(
  history: Message[],
  userMessage: string,
  existingContext: UserContext = {},
): Promise<PipelineResult> {
  const provider = getLLMProvider() as ClaudeProvider;
  const supervisors: SupervisorLog[] = [];
  const allSources = new Set<string>();
  const allTools = new Set<string>();

  const userContextPromise = extractUserContext(userMessage, existingContext);

  const userContextBlock = formatUserContext(existingContext);
  const systemContent = userContextBlock
    ? `${SYSTEM_PROMPT}\n\n[User Profile — personalize your response based on this]\n${userContextBlock}`
    : SYSTEM_PROMPT;

  const messages: Message[] = [
    { role: Role.System, content: systemContent },
    ...history.filter((m) => m.role !== Role.System),
  ];

  log.request(userMessage);

  const supervisorEnabled = process.env.SUPERVISOR_ENABLED !== 'false';

  // ── Travel Agent (initial) ───────────────────────────────────────────────
  let reply = await provider.chat(messages);
  provider.sources.forEach((s) => allSources.add(s));
  provider.toolsUsed.forEach((t) => allTools.add(t));

  log.travelAgent(reply, provider.toolsUsed, provider.sources);

  // ── Data Supervisor CLARIFY — short-circuit before anything else ─────────
  if (provider.clarification) {
    log.supervisor('Data Supervisor', Verdict.Clarify, 'Ambiguous entity — asking user for clarification');
    const userContext = await userContextPromise;
    log.pipelineEnd([]);
    return {
      reply: provider.clarification,
      sources: [],
      toolsUsed: [],
      supervisors: [{ name: 'Data Supervisor', verdict: SupervisorVerdict.Clarify }],
      userContext,
      isClarification: true,
    };
  }

  if (!supervisorEnabled) {
    const userContext = await userContextPromise;
    log.pipelineEnd([...allSources]);
    return { reply, sources: [...allSources], toolsUsed: [...allTools], supervisors, userContext };
  }

  const recentHistory = history
    .filter((m) => m.role !== 'system')
    .slice(-4)
    .map((m) => `${m.role}: ${m.content.slice(0, 150)}`)
    .join('\n');

  // ── Intent + Response Supervisors — run in parallel (optimistic) ─────────
  const [intentResult, optimisticResponseResult] = await Promise.all([
    runIntentSupervisor(userMessage, [...allTools], formatUserContext(existingContext) ?? undefined),
    runResponseSupervisor(
      userMessage,
      reply,
      recentHistory,
      [...allSources].filter((s) => LIVE_SOURCES.has(s)),
    ),
  ]);

  log.supervisor('Intent Supervisor', intentResult.verdict, intentResult.reasoning, intentResult.feedback);

  // ── Intent Supervisor CLARIFY — short-circuit ────────────────────────────
  if (intentResult.verdict === Verdict.Clarify) {
    const userContext = await userContextPromise;
    log.pipelineEnd([]);
    return {
      reply: intentResult.question ?? 'Could you clarify your question?',
      sources: [],
      toolsUsed: [],
      supervisors: [{ name: 'Intent Supervisor', verdict: SupervisorVerdict.Clarify }],
      userContext,
      isClarification: true,
    };
  }

  // ── Intent Supervisor retry ──────────────────────────────────────────────
  if (intentResult.verdict === Verdict.Refine) {
    log.supervisorRetry('Intent Supervisor');

    reply = await provider.chat([
      ...messages,
      { role: Role.Assistant, content: reply },
      {
        role: Role.User,
        content: `[TOOL SELECTION REVIEW: ${intentResult.feedback}\n\nPlease re-answer from scratch, calling the appropriate tools first.]`,
      },
    ]);

    provider.sources.forEach((s) => allSources.add(s));
    provider.toolsUsed.forEach((t) => allTools.add(t));
    supervisors.push({ name: 'Intent Supervisor', verdict: SupervisorVerdict.Refined });
    log.travelAgent(reply, provider.toolsUsed, provider.sources);

    // Check if the retry triggered a Data Supervisor CLARIFY
    if (provider.clarification) {
      log.supervisor('Data Supervisor', Verdict.Clarify, 'Ambiguous entity — asking user for clarification');
      const userContext = await userContextPromise;
      log.pipelineEnd([]);
      return {
        reply: provider.clarification,
        sources: [],
        toolsUsed: [],
        supervisors: [...supervisors, { name: 'Data Supervisor', verdict: SupervisorVerdict.Clarify }],
        userContext,
        isClarification: true,
      };
    }
  } else {
    supervisors.push({ name: 'Intent Supervisor', verdict: SupervisorVerdict.Pass });
  }

  // ── Data Supervisor — runs inside executor.ts per tool call ─────────────
  const hasLiveData = [...allSources].some((s) => LIVE_SOURCES.has(s));
  if (hasLiveData) {
    supervisors.push({ name: 'Data Supervisor', verdict: SupervisorVerdict.Pass });
  } else {
    log.supervisorSkipped('Data Supervisor', 'no external API data fetched');
    supervisors.push({ name: 'Data Supervisor', verdict: SupervisorVerdict.Skipped });
  }

  // ── Response Supervisor ──────────────────────────────────────────────────
  const liveDataSources = [...allSources].filter((s) => LIVE_SOURCES.has(s));
  const responseResult = intentResult.verdict === Verdict.Refine
    ? await runResponseSupervisor(userMessage, reply, recentHistory, liveDataSources)
    : optimisticResponseResult;

  log.supervisor('Response Supervisor', responseResult.verdict, responseResult.reasoning, responseResult.feedback);

  if (responseResult.verdict === Verdict.Refine) {
    log.supervisorRetry('Response Supervisor');

    reply = await provider.chat([
      ...messages,
      { role: Role.Assistant, content: reply },
      {
        role: Role.User,
        content: `[REVISION NEEDED: ${responseResult.feedback}\n\nPlease rewrite your response addressing the above. Do NOT start with an apology or say the previous response was wrong — just provide the improved answer directly.]`,
      },
    ], true);

    provider.sources.forEach((s) => allSources.add(s));
    provider.toolsUsed.forEach((t) => allTools.add(t));
    supervisors.push({ name: 'Response Supervisor', verdict: SupervisorVerdict.Refined });
  } else {
    supervisors.push({ name: 'Response Supervisor', verdict: SupervisorVerdict.Pass });
  }

  const userContext = await userContextPromise;
  if (Object.keys(userContext).length > Object.keys(existingContext).length) {
    console.log(`[user-context] updated: ${formatUserContext(userContext)}`);
  }

  log.pipelineEnd([...allSources]);
  return { reply, sources: [...allSources], toolsUsed: [...allTools], supervisors, userContext };
}
