import type { Message } from '../../shared/types.js';

export type { Message };

import type { ToolCache } from '../session/types.js';

export interface LLMProvider {
  chat(messages: Message[], disableTools?: boolean, toolCache?: ToolCache): Promise<string>;
}
