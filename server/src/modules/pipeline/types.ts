export interface SupervisorLog {
  name: string;
  verdict: 'PASS' | 'REFINED' | 'SKIPPED' | 'CLARIFY';
}

export interface PipelineResult {
  reply: string;
  sources: string[];
  toolsUsed: string[];
  supervisors: SupervisorLog[];
  userContext: import('../session/types.js').UserContext;
  isClarification?: boolean;
}
