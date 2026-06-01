export interface SupervisorLog {
  name: string;
  verdict: 'PASS' | 'REFINED' | 'SKIPPED';
}

export interface PipelineResult {
  reply: string;
  sources: string[];
  toolsUsed: string[];
  supervisors: SupervisorLog[];
  userContext: import('../session/types.js').UserContext;
}
