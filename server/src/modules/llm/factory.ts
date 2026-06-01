import type { LLMProvider } from './types.js';
import { ClaudeProvider } from './claude.js';

export function getLLMProvider(): LLMProvider {
  return new ClaudeProvider();
}
