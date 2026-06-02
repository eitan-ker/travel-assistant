import type { Message } from '../../shared/types.js';

export type { Message };

export interface LLMProvider {
  chat(messages: Message[], disableTools?: boolean): Promise<string>;
}
