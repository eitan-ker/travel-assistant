import { DataSource, Role, SupervisorVerdict, Verdict } from '../../shared/enums.js';
import { RECENT_MESSAGE_CONTEXT_CHARS, RECENT_HISTORY_WINDOW_SIZE, HISTORY_MESSAGE_SUMMARY_CHARS } from '../../shared/constants.js';
import { SYSTEM_PROMPT } from '../../prompts/system.js';
import { runResponseSupervisor } from '../supervisor/supervisors/response.js';
import { runPreflightSupervisor } from '../supervisor/supervisors/intent.js';
import { getLLMProvider } from '../llm/factory.js';
import { ClaudeProvider } from '../llm/claude.js';
import { log } from '../../utils/logger.js';
import { extractUserContext, formatUserContext } from '../session/userContext.js';
import { shouldCompact, compactHistory } from '../compaction/index.js';
import { buildCacheContextBlock } from '../tools/executor.js';
import type { UserContext, ToolCache } from '../session/types.js';
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

function collectProviderOutput(
  provider: ClaudeProvider,
  allSources: Set<string>,
  allTools: Set<string>,
): void {
  provider.sources.forEach((s) => allSources.add(s));
  provider.toolsUsed.forEach((t) => allTools.add(t));
}

export async function runPipeline(
  history: Message[],
  userMessage: string,
  existingContext: UserContext = {},
  toolCache: ToolCache = new Map(),
): Promise<PipelineResult & { compactedHistory?: Message[] }> {
  const provider = getLLMProvider() as ClaudeProvider;
  const supervisors: SupervisorLog[] = [];
  const allSources = new Set<string>();
  const allTools = new Set<string>();

  const lastAssistantMessage = [...history].reverse().find((m) => m.role === Role.Assistant)?.content;
  const userContextPromise = extractUserContext(userMessage, existingContext, lastAssistantMessage);

  const userContextBlock = formatUserContext(existingContext);
  const cacheBlock = buildCacheContextBlock(toolCache);

  const systemContent = [
    SYSTEM_PROMPT,
    userContextBlock ? `[User Profile — personalize your response based on this]\n${userContextBlock}` : '',
    cacheBlock ? `[Already fetched this session — do NOT call these tools again for the same destination]\n${cacheBlock}` : '',
  ].filter(Boolean).join('\n\n');

  const messages: Message[] = [
    { role: Role.System, content: systemContent },
    ...history.filter((m) => m.role !== Role.System),
  ];

  log.request(userMessage);

  const supervisorEnabled = process.env.SUPERVISOR_ENABLED !== 'false';

  // ── Pre-flight check — before any tools fire ─────────────────────────────
  let disableToolsForInitialRun = false;
  if (supervisorEnabled) {
    const lastAssistantMessage = [...history].reverse().find((m) => m.role === Role.Assistant)?.content;
    const userContextBlock = formatUserContext(existingContext);
    const sessionContext = [
      userContextBlock,
      lastAssistantMessage ? `Last assistant message: "${lastAssistantMessage.slice(0, RECENT_MESSAGE_CONTEXT_CHARS)}"` : '',
    ].filter(Boolean).join('\n') || undefined;

    const preflightResult = await runPreflightSupervisor(userMessage, sessionContext);
    log.supervisor('Pre-flight Supervisor', preflightResult.verdict, preflightResult.reasoning, preflightResult.feedback);

    if (preflightResult.verdict === Verdict.Clarify) {
      const userContext = await userContextPromise;
      log.pipelineEnd([]);
      return {
        reply: preflightResult.question ?? 'Could you be more specific about which destination you mean?',
        sources: [],
        toolsUsed: [],
        supervisors: [{ name: 'Pre-flight Supervisor', verdict: SupervisorVerdict.Clarify }],
        userContext,
        isClarification: true,
      };
    }

    supervisors.push({ name: 'Pre-flight Supervisor', verdict: SupervisorVerdict.Pass });
  }

  // ── Travel Agent (initial) ───────────────────────────────────────────────
  let reply = await provider.chat(messages, disableToolsForInitialRun, toolCache);
  collectProviderOutput(provider, allSources, allTools);

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
    .slice(-RECENT_HISTORY_WINDOW_SIZE)
    .map((m) => `${m.role}: ${m.content.slice(0, HISTORY_MESSAGE_SUMMARY_CHARS)}`)
    .join('\n');

  // ── Response Supervisor ──────────────────────────────────────────────────
  const optimisticResponseResult = await runResponseSupervisor(
    userMessage,
    reply,
    recentHistory,
    [...allSources].filter((s) => LIVE_SOURCES.has(s)),
  );

  // ── Data Supervisor — runs inside executor.ts per tool call ─────────────
  const hasLiveData = [...allSources].some((s) => LIVE_SOURCES.has(s));
  if (hasLiveData) {
    supervisors.push({ name: 'Data Supervisor', verdict: SupervisorVerdict.Pass });
  } else {
    log.supervisorSkipped('Data Supervisor', 'no external API data fetched');
    supervisors.push({ name: 'Data Supervisor', verdict: SupervisorVerdict.Skipped });
  }

  const responseResult = optimisticResponseResult;

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

  // ── History compaction — check after response is finalized ───────────────
  const historyWithCurrentTurn = [
    ...history.filter((m) => m.role !== Role.System),
    { role: Role.User, content: userMessage } as Message,
    { role: Role.Assistant, content: reply } as Message,
  ];

  let compactedHistory: Message[] | undefined;
  if (shouldCompact(historyWithCurrentTurn)) {
    console.log('[compaction] threshold exceeded — compacting history');
    compactedHistory = await compactHistory(historyWithCurrentTurn);
  }

  // Strip excessive blank lines and whitespace gaps to prevent large gaps in UI rendering
  const cleanedReply = reply
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+(\|)/g, '\n$1')  // remove ALL blank lines before table rows
    .replace(/<br\s*\/?>/gi, '')   // strip br tags that create invisible height
    .trim();

  log.pipelineEnd([...allSources]);
  return { reply: cleanedReply, sources: [...allSources], toolsUsed: [...allTools], supervisors, userContext, compactedHistory };
}
