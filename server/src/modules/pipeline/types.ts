import { SupervisorVerdict } from '../../shared/enums.js';
import type { UserContext } from '../session/types.js';

export { SupervisorVerdict };

export interface SupervisorLog {
  name: string;
  verdict: SupervisorVerdict;
}

export interface PipelineResult {
  reply: string;
  sources: string[];
  toolsUsed: string[];
  supervisors: SupervisorLog[];
  userContext: UserContext;
  isClarification?: boolean;
}
