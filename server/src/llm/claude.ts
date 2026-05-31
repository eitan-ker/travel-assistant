import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, Message } from './provider.js';
import { TRAVEL_TOOLS } from '../tools/definitions.js';
import { executeTool } from '../tools/executor.js';

export class ClaudeProvider implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;
  public sources: string[] = [];
  public toolsUsed: string[] = [];

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
  }

  async chat(messages: Message[]): Promise<string> {
    this.sources = ['Claude'];
    this.toolsUsed = [];

    const system = messages.find((m) => m.role === 'system')?.content;
    const conversation = messages.filter((m) => m.role !== 'system');

    const anthropicMessages: Anthropic.MessageParam[] = conversation.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Tool use loop — Claude may call multiple tools before giving a final response
    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        ...(system ? { system } : {}),
        tools: TRAVEL_TOOLS,
        tool_choice: { type: 'auto' },
        messages: anthropicMessages,
      });

      // If Claude is done — return the text response
      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b) => b.type === 'text');
        return textBlock?.type === 'text' ? textBlock.text : '';
      }

      // Claude wants to call tools
      if (response.stop_reason === 'tool_use') {
        anthropicMessages.push({ role: 'assistant', content: response.content });

        const toolBlocks = response.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
        toolBlocks.forEach((b) => this.toolsUsed.push(b.name));

        // Execute all tool calls in parallel
        const toolResults = await Promise.all(
          toolBlocks.map(async (block): Promise<Anthropic.ToolResultBlockParam> => {
            try {
              const result = await executeTool(block.name, block.input as Record<string, string>);
              if (result.source) this.sources.push(result.source);
              return { type: 'tool_result', tool_use_id: block.id, content: result.content };
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Tool execution failed';
              console.error(`[tool-error] ${block.name}: ${msg}`);
              return {
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Tool failed: ${msg}. Use your general knowledge instead.`,
                is_error: true,
              };
            }
          }),
        );

        // Return tool results to Claude so it can continue
        anthropicMessages.push({ role: 'user', content: toolResults });
      }
    }
  }
}
