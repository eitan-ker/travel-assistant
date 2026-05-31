import { SYSTEM_PROMPT } from '../prompts/system.js';
import { runResponseSupervisor } from '../supervisor/responseSupervisor.js';
import { runIntentSupervisor } from '../supervisor/intentSupervisor.js';
import { getLLMProvider } from '../llm/factory.js';
import { ClaudeProvider } from '../llm/claude.js';
import { log } from '../utils/logger.js';
import type { Message } from '../llm/provider.js';

export interface SupervisorLog {
  name: string;
  verdict: 'PASS' | 'REFINED' | 'SKIPPED';
}

export interface PipelineResult {
  reply: string;
  sources: string[];
  toolsUsed: string[];
  supervisors: SupervisorLog[];
}

export async function runPipeline(history: Message[], userMessage: string): Promise<PipelineResult> {
  const provider = getLLMProvider() as ClaudeProvider;
  const supervisors: SupervisorLog[] = [];
  const allSources = new Set<string>();
  const allTools = new Set<string>();

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.filter((m) => m.role !== 'system'),
  ];

  log.request(userMessage);

  const supervisorEnabled = process.env.SUPERVISOR_ENABLED !== 'false';

  // ── Travel Agent (initial) ───────────────────────────────────────────────
  let reply = await provider.chat(messages);
  provider.sources.forEach((s) => allSources.add(s));
  provider.toolsUsed.forEach((t) => allTools.add(t));

  log.travelAgent(reply, provider.toolsUsed, provider.sources);

  if (!supervisorEnabled) {
    log.pipelineEnd([...allSources]);
    return { reply, sources: [...allSources], toolsUsed: [...allTools], supervisors };
  }

  const recentHistory = history
    .filter((m) => m.role !== 'system')
    .slice(-4)
    .map((m) => `${m.role}: ${m.content.slice(0, 150)}`)
    .join('\n');

  // ── Intent + Response Supervisors — run in parallel (optimistic) ─────────
  const [intentResult, optimisticResponseResult] = await Promise.all([
    runIntentSupervisor(userMessage, [...allTools]),
    runResponseSupervisor(userMessage, reply, recentHistory,
      [...allSources].filter((s) => ['OpenWeatherMap', 'RestCountries', 'OpenTripMap'].includes(s))
    ),
  ]);

  log.supervisor('Intent Supervisor', intentResult.verdict, intentResult.reasoning, intentResult.feedback);

  // ── Intent Supervisor retry ──────────────────────────────────────────────
  if (intentResult.verdict === 'REFINE') {
    log.supervisorRetry('Intent Supervisor');

    reply = await provider.chat([
      ...messages,
      { role: 'assistant', content: reply },
      {
        role: 'user',
        content: `[TOOL SELECTION REVIEW: ${intentResult.feedback}\n\nPlease re-answer from scratch, calling the appropriate tools first.]`,
      },
    ]);

    provider.sources.forEach((s) => allSources.add(s));
    provider.toolsUsed.forEach((t) => allTools.add(t));
    supervisors.push({ name: 'Intent Supervisor', verdict: 'REFINED' });
    log.travelAgent(reply, provider.toolsUsed, provider.sources);
  } else {
    supervisors.push({ name: 'Intent Supervisor', verdict: 'PASS' });
  }

  // ── Data Supervisor — runs inside executor.ts per tool call ─────────────
  const hasLiveData = [...allSources].some((s) => ['OpenWeatherMap', 'RestCountries', 'OpenTripMap'].includes(s));
  if (hasLiveData) {
    supervisors.push({ name: 'Data Supervisor', verdict: 'PASS' });
  } else {
    log.supervisorSkipped('Data Supervisor', 'no external API data fetched');
    supervisors.push({ name: 'Data Supervisor', verdict: 'SKIPPED' });
  }

  // ── Response Supervisor ──────────────────────────────────────────────────
  // Use optimistic result if Intent passed (reply unchanged), re-run if Intent retried
  const liveDataSources = [...allSources].filter((s) => ['OpenWeatherMap', 'RestCountries', 'OpenTripMap'].includes(s));
  const responseResult = intentResult.verdict === 'REFINE'
    ? await runResponseSupervisor(userMessage, reply, recentHistory, liveDataSources)
    : optimisticResponseResult;

  log.supervisor('Response Supervisor', responseResult.verdict, responseResult.reasoning, responseResult.feedback);

  if (responseResult.verdict === 'REFINE') {
    log.supervisorRetry('Response Supervisor');

    reply = await provider.chat([
      ...messages,
      { role: 'assistant', content: reply },
      {
        role: 'user',
        content: `[QUALITY REVIEW FAILED: ${responseResult.feedback}\n\nIMPORTANT: You MUST provide a direct answer now. Do NOT ask clarifying questions without first giving a substantive response.]`,
      },
    ]);

    provider.sources.forEach((s) => allSources.add(s));
    provider.toolsUsed.forEach((t) => allTools.add(t));
    supervisors.push({ name: 'Response Supervisor', verdict: 'REFINED' });
  } else {
    supervisors.push({ name: 'Response Supervisor', verdict: 'PASS' });
  }

  log.pipelineEnd([...allSources]);
  return { reply, sources: [...allSources], toolsUsed: [...allTools], supervisors };
}
