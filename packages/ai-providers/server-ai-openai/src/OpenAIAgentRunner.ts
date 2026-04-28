import { OpenAI } from 'openai';

import type {
  LDAIMetrics,
  LDLogger,
  LDMessage,
  LDTokenUsage,
  Runner,
  RunnerResult,
} from '@launchdarkly/server-sdk-ai';

import { convertMessagesToOpenAI } from './openaiHelper';

/**
 * Tool registry mapping tool names to their callable implementations.
 * The callable receives the parsed JSON arguments from the model and returns
 * a string (or value coercible to string) representing the tool result.
 */
export type ToolRegistry = Record<string, (args: any) => unknown | Promise<unknown>>;

const MAX_ITERATIONS = 25;

/**
 * Runner implementation for a single OpenAI agent.
 *
 * Executes a tool-calling loop using the OpenAI Chat Completions API. Tool
 * definitions come from the LD AI config; tool implementations come from the
 * caller-supplied {@link ToolRegistry}. Returned by
 * {@link OpenAIRunnerFactory.createAgent}.
 */
export class OpenAIAgentRunner implements Runner {
  private _client: OpenAI;
  private _modelName: string;
  private _parameters: Record<string, unknown>;
  private _instructions: string;
  private _toolDefinitions: any[];
  private _tools: ToolRegistry;
  private _logger?: LDLogger;

  constructor(
    client: OpenAI,
    modelName: string,
    parameters: Record<string, unknown>,
    instructions: string,
    toolDefinitions: any[],
    tools: ToolRegistry,
    logger?: LDLogger,
  ) {
    this._client = client;
    this._modelName = modelName;
    this._parameters = parameters;
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
    const messages: any[] = [];
    if (this._instructions) {
      messages.push({ role: 'system', content: this._instructions });
    }
    messages.push(...convertMessagesToOpenAI(input));

    const toolCalls: string[] = [];
    const totalUsage: LDTokenUsage = { total: 0, input: 0, output: 0 };
    let response: any;

    try {
      for (let i = 0; i < MAX_ITERATIONS; i += 1) {
        const params: any = {
          ...this._parameters,
          model: this._modelName,
          messages,
        };
        if (this._toolDefinitions.length > 0) {
          params.tools = this._toolDefinitions;
        }

        // eslint-disable-next-line no-await-in-loop
        response = await this._client.chat.completions.create(params);

        if (response?.usage) {
          totalUsage.total += response.usage.total_tokens || 0;
          totalUsage.input += response.usage.prompt_tokens || 0;
          totalUsage.output += response.usage.completion_tokens || 0;
        }

        const choice = response?.choices?.[0];
        const message = choice?.message;
        if (!message) {
          break;
        }

        const requestedToolCalls = message.tool_calls ?? [];
        if (requestedToolCalls.length === 0) {
          break;
        }

        messages.push(message);

        // eslint-disable-next-line no-restricted-syntax
        for (const tc of requestedToolCalls) {
          const toolName = tc?.function?.name;
          if (toolName) {
            toolCalls.push(toolName);
          }
          // eslint-disable-next-line no-await-in-loop
          const toolResult = await this._executeTool(toolName, tc?.function?.arguments);
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: toolResult,
          });
        }
      }

      const finalContent = response?.choices?.[0]?.message?.content || '';
      const metrics: LDAIMetrics = {
        success: true,
        usage: totalUsage,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };

      return { content: finalContent, metrics, raw: response };
    } catch (error) {
      this._logger?.warn('OpenAI agent run failed:', error);
      return {
        content: '',
        metrics: { success: false },
      };
    }
  }

  private async _executeTool(
    name: string | undefined,
    argsJson: string | undefined,
  ): Promise<string> {
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
    let args: any = {};
    if (argsJson) {
      try {
        args = JSON.parse(argsJson);
      } catch (error) {
        this._logger?.warn(`Failed to parse tool arguments for '${name}':`, error);
      }
    }
    try {
      const result = await fn(args);
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (error) {
      this._logger?.warn(`Tool '${name}' execution failed:`, error);
      return '';
    }
  }
}
