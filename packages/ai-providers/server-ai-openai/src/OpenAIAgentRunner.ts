import type {
  LDAIMetrics,
  LDLogger,
  LDTokenUsage,
  Runner,
  RunnerResult,
} from '@launchdarkly/server-sdk-ai';

import {
  getAIUsageFromAgentResult,
  getToolCallsFromRunItems,
} from './OpenAIHelper';

/**
 * Tool registry mapping tool names to their callable implementations or
 * pre-built openai-agents tool instances (e.g. `webSearchTool()`).
 */
export type ToolRegistry = Record<string, ((...args: any[]) => unknown | Promise<unknown>) | unknown>;

const MAX_TURNS = 25;

/**
 * Runner implementation for a single OpenAI agent.
 *
 * Executes a pre-built agent using the OpenAI Agents SDK (`@openai/agents`).
 * Tool calling and the agentic loop are handled internally by the SDK's
 * `run()` function. Created by {@link OpenAIRunnerFactory.createAgent}.
 *
 * Requires `@openai/agents` to be installed.
 */
export class OpenAIAgentRunner implements Runner {
  private _agent: any;
  private _agentRun: (agent: any, input: string, opts: any) => Promise<any>;
  private _logger?: LDLogger;
  private _toolNameMap: Record<string, string>;

  constructor(
    agent: any,
    agentRun: (agent: any, input: string, opts: any) => Promise<any>,
    toolNameMap: Record<string, string>,
    logger?: LDLogger,
  ) {
    this._agent = agent;
    this._agentRun = agentRun;
    this._toolNameMap = toolNameMap;
    this._logger = logger;
  }

  async run(input: string, _outputType?: Record<string, unknown>): Promise<RunnerResult> {
    try {
      const result = await this._agentRun(this._agent, input, { maxTurns: MAX_TURNS });

      const toolCalls = getToolCallsFromRunItems(result.newItems ?? []).reduce(
        (acc: string[], fnName: string) => {
          const ldName = this._toolNameMap[fnName];
          if (ldName) {
            acc.push(ldName);
          }
          return acc;
        },
        [],
      );

      const usage: LDTokenUsage | undefined = getAIUsageFromAgentResult(result);
      const metrics: LDAIMetrics = {
        success: true,
        usage,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };

      return {
        content: String(result.finalOutput ?? ''),
        metrics,
        raw: result,
      };
    } catch (error) {
      this._logger?.warn('OpenAI agent run failed:', error);
      return {
        content: '',
        metrics: { success: false },
      };
    }
  }
}
