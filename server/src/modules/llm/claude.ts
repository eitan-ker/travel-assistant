import Anthropic from '@anthropic-ai/sdk';
import { DataSource, Role } from '../../shared/enums.js';
import { MAIN_CHAT_MAX_TOKENS } from '../../shared/constants.js';
import type { LLMProvider, Message } from './types.js';
import type { ToolCache } from '../session/types.js';
import { TRAVEL_TOOLS } from '../tools/index.js';
import { web_search } from '../tools/definitions/claude/web_search.js';
import { executeTool } from '../tools/index.js';

export class ClaudeProvider implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;
  public sources: string[] = [];
  public toolsUsed: string[] = [];
  public clarification: string | null = null;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
  }

  async chat(messages: Message[], disableTools = false, toolCache?: ToolCache): Promise<string> {
    this.sources = [DataSource.Claude];
    this.toolsUsed = [];
    this.clarification = null;

    const system = messages.find((m) => m.role === Role.System)?.content;
    const conversation = messages.filter((m) => m.role !== Role.System);

    const anthropicMessages: Anthropic.MessageParam[] = conversation.map((m) => ({
      role: m.role as Anthropic.MessageParam['role'],
      content: m.content,
    }));

    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: MAIN_CHAT_MAX_TOKENS,
        ...(system ? { system } : {}),
        ...(disableTools
          ? {}
          : {
              tools: [...TRAVEL_TOOLS, web_search],
              tool_choice: { type: 'auto' },
            }),
        messages: anthropicMessages,
      });

      if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
        const hasWebResults = response.content.some((b) => b.type === 'web_search_tool_result');
        if (hasWebResults) {
          this.sources.push(DataSource.WebSearch);
          this.toolsUsed.push('web_search');
        }
        if (response.stop_reason === 'max_tokens') {
          console.warn('[claude] max_tokens hit — response was truncated');
        }
        // Concatenate all text blocks — web search interleaves result blocks between text blocks
        const text = response.content
          .filter((b) => b.type === 'text')
          .map((b) => (b.type === 'text' ? b.text : ''))
          .join('');
        // Strip any leaked function call/result XML (can appear when tools are disabled on retry)
        return text
          .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '')
          .replace(/<function_results>[\s\S]*?<\/function_results>/g, '')
          .replace(/<\/?function_(calls|results)>/g, '')
          .trim();
      }

      if (response.stop_reason === 'tool_use') {
        anthropicMessages.push({ role: 'assistant', content: response.content });

        const toolBlocks = response.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
        this.toolsUsed.push(...toolBlocks.map((b) => b.name));

        // Web search is server-executed by Anthropic — skip client-side execution for those
        const clientToolBlocks = toolBlocks.filter((b) => b.name !== 'web_search');
        const hasWebSearch = toolBlocks.some((b) => b.name === 'web_search');

        if (hasWebSearch) this.sources.push(DataSource.WebSearch);

        if (clientToolBlocks.length === 0) {
          // Only web search calls — Anthropic handles them, just continue the loop
          continue;
        }

        const toolResults = await Promise.all(
          clientToolBlocks.map(async (block): Promise<Anthropic.ToolResultBlockParam> => {
            try {
              const result = await executeTool(block.name, block.input as Record<string, string>, toolCache);
              if (result.source) this.sources.push(result.source);
              if (result.clarification) this.clarification = result.clarification;
              return { type: 'tool_result', tool_use_id: block.id, content: result.content || 'Data unavailable — use your general knowledge.' };
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

        anthropicMessages.push({ role: 'user', content: toolResults });
      }
    }
  }
}
