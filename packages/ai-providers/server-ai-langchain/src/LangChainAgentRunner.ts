import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, BaseMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';

import type {
  LDAIMetrics,
  LDLogger,
  LDMessage,
  LDTokenUsage,
  Runner,
  RunnerResult,
} from '@launchdarkly/server-sdk-ai';

import { convertMessagesToLangChain } from './langchainHelper';

/**
 * Tool registry mapping tool names to their callable implementations.
 */
export type ToolRegistry = Record<string, (args: any) => unknown | Promise<unknown>>;

const MAX_ITERATIONS = 25;

/**
 * Runner implementation for a single LangChain agent.
 *
 * Binds tool definitions to the chat model and runs a tool-calling loop using
 * LangChain's native tool-calling support. Tool definitions come from the
 * LD AI config; tool implementations come from the caller-supplied
 * {@link ToolRegistry}. Returned by {@link LangChainRunnerFactory.createAgent}.
 */
export class LangChainAgentRunner implements Runner {
  private _llm: BaseChatModel;
  private _instructions: string;
  private _toolDefinitions: any[];
  private _tools: ToolRegistry;
  private _logger?: LDLogger;

  constructor(
    llm: BaseChatModel,
    instructions: string,
    toolDefinitions: any[],
    tools: ToolRegistry,
    logger?: LDLogger,
  ) {
    this._llm = llm;
    this._instructions = instructions;
    this._toolDefinitions = toolDefinitions;
    this._tools = tools;
    this._logger = logger;
  }

  /**
   * Run the agent with the given messages.
   *
   * @param input Array of LDMessage objects
   * @param _outputType Reserved for future structured output support; currently
   *   ignored by the agent runner.
   */
  async run(input: LDMessage[], _outputType?: Record<string, unknown>): Promise<RunnerResult> {
    const messages: BaseMessage[] = [];
    if (this._instructions) {
      messages.push(new SystemMessage(this._instructions));
    }
    messages.push(...convertMessagesToLangChain(input));

    const llm =
      this._toolDefinitions.length > 0 && typeof (this._llm as any).bindTools === 'function'
        ? (this._llm as any).bindTools(this._toolDefinitions)
        : this._llm;

    const toolCalls: string[] = [];
    const totalUsage: LDTokenUsage = { total: 0, input: 0, output: 0 };
    let response: AIMessage | undefined;

    try {
      for (let i = 0; i < MAX_ITERATIONS; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        response = (await llm.invoke(messages)) as AIMessage;

        if (response?.usage_metadata) {
          totalUsage.total += response.usage_metadata.total_tokens || 0;
          totalUsage.input += response.usage_metadata.input_tokens || 0;
          totalUsage.output += response.usage_metadata.output_tokens || 0;
        }

        const requestedToolCalls = response?.tool_calls ?? [];
        if (requestedToolCalls.length === 0) {
          break;
        }

        messages.push(response);

        // eslint-disable-next-line no-restricted-syntax
        for (const tc of requestedToolCalls) {
          const toolName = tc.name;
          if (toolName) {
            toolCalls.push(toolName);
          }
          // eslint-disable-next-line no-await-in-loop
          const toolResult = await this._executeTool(toolName, tc.args);
          messages.push(
            new ToolMessage({
              tool_call_id: tc.id ?? '',
              content: toolResult,
            }),
          );
        }
      }

      const finalContent = typeof response?.content === 'string' ? response.content : '';
      const metrics: LDAIMetrics = {
        success: true,
        usage: totalUsage,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };

      return { content: finalContent, metrics, raw: response };
    } catch (error) {
      this._logger?.warn('LangChain agent run failed:', error);
      return {
        content: '',
        metrics: { success: false },
      };
    }
  }

  private async _executeTool(name: string | undefined, args: any): Promise<string> {
    if (!name) {
      return '';
    }
    const fn = this._tools[name];
    if (!fn) {
      this._logger?.warn(
        `Tool '${name}' is defined in the AI config but was not found in ` +
          `the tool registry; returning empty result.`,
      );
      return '';
    }
    try {
      const result = await fn(args ?? {});
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (error) {
      this._logger?.warn(`Tool '${name}' execution failed:`, error);
      return '';
    }
  }
}
