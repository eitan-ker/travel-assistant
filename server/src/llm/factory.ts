import type { LLMProvider } from './provider.js';
import { ClaudeProvider } from './claude.js';

export function getLLMProvider(): LLMProvider {
  return new ClaudeProvider();
}
