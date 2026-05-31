import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, Message } from './provider.js';

export class ClaudeProvider implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
  }

  async chat(messages: Message[]): Promise<string> {
    const system = messages.find((m) => m.role === 'system')?.content;
    const conversation = messages.filter((m) => m.role !== 'system');

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      ...(system ? { system } : {}),
      messages: conversation as Anthropic.MessageParam[],
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
    return block.text;
  }
}
