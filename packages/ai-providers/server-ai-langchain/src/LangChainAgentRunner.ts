import type { BaseMessage } from '@langchain/core/messages';

import type { LDAIMetrics, LDLogger, RunnerResult, Runner } from '@launchdarkly/server-sdk-ai';

import {
  extractLastMessageContent,
  extractToolCalls,
  sumTokenUsageFromMessages,
} from './LangChainHelper';

/**
 * Tool registry mapping tool names to their callable implementations.
 */
export type ToolRegistry = Record<string, (args: any) => unknown>;

/**
 * Minimal interface for a compiled LangChain agent (from `createAgent`).
 * The agent handles the tool-calling loop internally.
 */
export interface CompiledAgent {
  invoke(input: Record<string, any>): Promise<{ messages: BaseMessage[] }>;
}

/**
 * Runner implementation for a single LangChain agent.
 *
 * Wraps a compiled LangChain agent graph (from `langchain`'s `createAgent`)
 * and delegates execution to it. Tool calling and loop management are handled
 * internally by the graph, matching the Python SDK's approach.
 *
 * Returned by {@link LangChainRunnerFactory.createAgent}.
 */
export class LangChainAgentRunner implements Runner {
  private _agent: CompiledAgent;
  private _logger?: LDLogger;

  constructor(agent: CompiledAgent, logger?: LDLogger) {
    this._agent = agent;
    this._logger = logger;
  }

  /**
   * Run the agent with the given prompt.
   *
   * Delegates to the compiled LangChain agent, which handles the
   * tool-calling loop internally.
   *
   * @param input The user prompt to send to the agent.
   * @param _outputType Reserved for future structured output support; currently
   *   ignored by the agent runner.
   */
  async run(input: string, _outputType?: Record<string, unknown>): Promise<RunnerResult> {
    try {
      const result = await this._agent.invoke({
        messages: [{ role: 'user', content: input }],
      });

      const messages = result.messages ?? [];
      const content = extractLastMessageContent(messages);
      const toolCalls = extractToolCalls(messages);

      const metrics: LDAIMetrics = {
        success: true,
        usage: sumTokenUsageFromMessages(messages),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };

      return { content, metrics, raw: result };
    } catch (error) {
      this._logger?.warn('LangChain agent run failed:', error);
      return {
        content: '',
        metrics: { success: false },
      };
    }
  }

  /**
   * Return the underlying compiled LangChain agent.
   */
  getAgent(): CompiledAgent {
    return this._agent;
  }
}
