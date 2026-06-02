import { ClaudeProvider } from './claude.js';

export function getLLMProvider(): ClaudeProvider {
  return new ClaudeProvider();
}
