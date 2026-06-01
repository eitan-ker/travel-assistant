import type { Message } from '../../shared/types.js';

export type { Message };

export interface LLMProvider {
  chat(messages: Message[]): Promise<string>;
}
