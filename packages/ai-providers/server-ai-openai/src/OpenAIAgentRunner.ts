import type {
  LDAIAgentConfig,
  LDAIMetrics,
  LDLogger,
  LDTokenUsage,
  Runner,
  RunnerResult,
} from '@launchdarkly/server-sdk-ai';

import {
  getAIUsageFromAgentResult,
  getToolCallsFromRunItems,
  isAgentToolInstance,
  registryValueToAgentTool,
} from './OpenAIHelper';

/**
 * Tool registry mapping tool names to their callable implementations or
 * pre-built openai-agents tool instances (e.g. `webSearchTool()`).
 */
export type ToolRegistry = Record<string, ((...args: any[]) => unknown | Promise<unknown>) | unknown>;

const MAX_TURNS = 25;

const KNOWN_MODEL_SETTINGS = new Set([
  'temperature',
  'topP',
  'top_p',
  'maxTokens',
  'max_tokens',
  'frequencyPenalty',
  'frequency_penalty',
  'presencePenalty',
  'presence_penalty',
]);

/**
 * Map from snake_case parameter names (LD config) to camelCase (Agents SDK ModelSettings).
 */
const PARAM_KEY_MAP: Record<string, string> = {
  top_p: 'topP',
  max_tokens: 'maxTokens',
  frequency_penalty: 'frequencyPenalty',
  presence_penalty: 'presencePenalty',
};

/**
 * Runner implementation for a single OpenAI agent.
 *
 * Executes a single agent using the OpenAI Agents SDK (`@openai/agents`).
 * Tool calling and the agentic loop are handled internally by the SDK's
 * `run()` function. Returned by {@link OpenAIRunnerFactory.createAgent}.
 *
 * The Agent is constructed once (lazily on first `run()` call) and reused
 * for subsequent invocations. The dynamic import of `@openai/agents` is
 * also cached so the cost is paid only once.
 *
 * Requires `@openai/agents` to be installed.
 */
export class OpenAIAgentRunner implements Runner {
  private _modelName: string;
  private _parameters: Record<string, unknown>;
  private _instructions: string;
  private _toolDefinitions: any[];
  private _tools: ToolRegistry;
  private _logger?: LDLogger;
  private _toolNameMap: Record<string, string> = {};

  private _agent: any;
  private _agentRun: any;
  private _initPromise: Promise<boolean> | undefined;

  constructor(
    config: LDAIAgentConfig,
    tools: ToolRegistry,
    logger?: LDLogger,
  ) {
    this._modelName = config.model?.name ?? '';
    const parameters: Record<string, unknown> = { ...(config.model?.parameters ?? {}) };
    this._toolDefinitions = (parameters.tools as any[] | undefined) ?? [];
    delete parameters.tools;
    this._parameters = parameters;
    this._instructions = config.instructions ?? '';
    this._tools = tools;
    this._logger = logger;
  }

  /**
   * Lazily import `@openai/agents` and construct the Agent. The result is
   * cached so the Agent instance is reused across all `run()` calls.
   *
   * @returns `true` if initialisation succeeded, `false` if the SDK is unavailable.
   */
  private _ensureAgent(): Promise<boolean> {
    if (this._initPromise) {
      return this._initPromise;
    }
    this._initPromise = this._init();
    return this._initPromise;
  }

  private async _init(): Promise<boolean> {
    let Agent: any;
    let agentRun: any;
    let toolHelper: any;
    try {
      const agents = await import('@openai/agents');
      Agent = agents.Agent;
      agentRun = agents.run;
      toolHelper = agents.tool;
    } catch (e) {
      this._logger?.warn(
        `@openai/agents is required for OpenAIAgentRunner.\n` +
          `Install it with: npm install @openai/agents openai zod\n`,
        e,
      );
      return false;
    }

    const agentTools = this._buildAgentTools(toolHelper);
    const modelSettings = this._buildModelSettings();

    this._agent = new Agent({
      name: 'ldai-agent',
      instructions: this._instructions || undefined,
      model: this._modelName,
      tools: agentTools,
      modelSettings,
    });
    this._agentRun = agentRun;
    return true;
  }

  async run(input: string, _outputType?: Record<string, unknown>): Promise<RunnerResult> {
    const ready = await this._ensureAgent();
    if (!ready) {
      return { content: '', metrics: { success: false } };
    }

    try {
      const result = await this._agentRun(this._agent, String(input), { maxTurns: MAX_TURNS });

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

  /**
   * Build tool instances from LD tool definitions and the caller's registry.
   *
   * Also populates `_toolNameMap` so observed tool-call names from the
   * runtime can be translated back to their LD config keys for metric
   * reporting.
   */
  private _buildAgentTools(toolHelper: any): any[] {
    const tools: any[] = [];
    this._toolNameMap = {};

    for (const td of this._toolDefinitions) {
      if (!td || typeof td !== 'object') {
        continue;
      }
      const funcDef = td.function ?? td;
      const name: string = funcDef?.name ?? '';
      if (!name) {
        continue;
      }

      const toolFn = this._tools[name];
      if (toolFn !== undefined) {
        if (isAgentToolInstance(toolFn)) {
          const instanceName = (toolFn as any).name ?? name;
          this._toolNameMap[instanceName] = name;
        } else {
          const fnName = (toolFn as any).name ?? name;
          this._toolNameMap[fnName] = name;
        }
        tools.push(registryValueToAgentTool(toolFn, toolHelper, td));
        continue;
      }

      this._logger?.warn(
        `Tool '${name}' is defined in the AI config but was not found in ` +
          `the tool registry; skipping.`,
      );
    }
    return tools;
  }

  private _buildModelSettings(): Record<string, unknown> | undefined {
    const settings: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this._parameters)) {
      if (KNOWN_MODEL_SETTINGS.has(key)) {
        const mappedKey = PARAM_KEY_MAP[key] ?? key;
        settings[mappedKey] = value;
      }
    }
    return Object.keys(settings).length > 0 ? settings : undefined;
  }
}
