import type { LDAIMetrics, LDLogger, LDMessage, LDTool, LDTokenUsage } from '@launchdarkly/server-sdk-ai';

import type { ToolRegistry } from './OpenAIAgentRunner';

/**
 * OpenAI chat completion message format.
 * Mirrors the relevant subset of OpenAI's `ChatCompletionMessageParam`.
 */
export interface OpenAIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Convert LaunchDarkly messages to OpenAI chat completion message format.
 *
 * @param messages Array of LDMessage objects
 * @returns Array of OpenAI ChatCompletionMessageParam-compatible objects
 */
export function convertMessagesToOpenAI(messages: LDMessage[]): OpenAIChatMessage[] {
  return messages.map((msg) => ({ role: msg.role, content: msg.content }));
}

/**
 * Extract token usage from an OpenAI response.
 */
export function getAIUsageFromResponse(response: any): LDTokenUsage | undefined {
  if (!response?.usage) {
    return undefined;
  }
  const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
  return {
    total: total_tokens || 0,
    input: prompt_tokens || 0,
    output: completion_tokens || 0,
  };
}

/**
 * Get AI metrics from an OpenAI response.
 */
export function getAIMetricsFromResponse(response: any): LDAIMetrics {
  return {
    success: true,
    usage: getAIUsageFromResponse(response),
  };
}

/**
 * Convert a snake_case string to camelCase.
 */
function _snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Convert all snake_case keys in a record to camelCase.
 */
export function _mapParameterKeys(parameters: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parameters)) {
    result[_snakeToCamel(key)] = value;
  }
  return result;
}

// ============================================================================
// OpenAI Agents SDK helpers
// ============================================================================

const OPENAI_HOSTED_TOOL_NAMES = new Set([
  'web_search',
  'file_search',
  'code_interpreter',
  'tool_search',
]);

/**
 * Extract aggregated token usage from an openai-agents RunResult.
 *
 * Reads `result.runContext.usage` which the Agents SDK populates
 * automatically across all model calls within a single run.
 */
export function getAIUsageFromAgentResult(result: any): LDTokenUsage | undefined {
  try {
    const { usage } = result.runContext;
    if (!usage) {
      return undefined;
    }
    const total = usage.totalTokens || 0;
    const input = usage.inputTokens || 0;
    const output = usage.outputTokens || 0;
    if (total || input || output) {
      return { total, input, output };
    }
  } catch {
    // fall through
  }
  return undefined;
}

/**
 * Extract tool call names from RunResult.newItems.
 *
 * Returns an array of tool names observed during the run. For function_call
 * items the raw function name is returned; for hosted tool calls the
 * canonical name (without the `_call` suffix) is used when it matches a
 * known OpenAI hosted tool.
 */
export function getToolCallsFromRunItems(newItems: any[]): string[] {
  const result: string[] = [];
  for (const item of newItems) {
    if (item?.type !== 'tool_call_item') {
      continue;
    }
    const raw = item.rawItem;
    if (!raw) {
      continue;
    }
    if (raw.type === 'function_call') {
      if (raw.name) {
        result.push(raw.name);
      }
    } else if (typeof raw.type === 'string') {
      if (raw.type === 'hosted_tool_call' && raw.name) {
        result.push(raw.name);
      } else if (raw.type.endsWith('_call')) {
        const base = raw.type.slice(0, -'_call'.length);
        result.push(OPENAI_HOSTED_TOOL_NAMES.has(base) ? base : raw.type);
      }
    }
  }
  return result;
}

/**
 * True if `value` is already an openai-agents tool object (not a plain callable).
 */
export function isAgentToolInstance(value: unknown): boolean {
  return typeof value !== 'function';
}

/**
 * Turn a ToolRegistry value into an object the OpenAI Agents SDK accepts
 * in `Agent({ tools: [...] })`.
 *
 * Plain callables are wrapped with the Agents SDK `tool()` helper using the
 * JSON schema from the LD tool definition. Values that are already tool
 * instances (e.g., `webSearchTool()`, `fileSearchTool(...)`) are returned
 * unchanged.
 */
export function registryValueToAgentTool(
  value: unknown,
  toolHelper: (opts: any) => any,
  definition?: LDTool,
): any {
  if (isAgentToolInstance(value)) {
    return value;
  }
  const fn = value as (...args: any[]) => any;
  return toolHelper({
    name: definition?.name ?? fn.name ?? 'unknown',
    description: definition?.description ?? '',
    parameters: definition?.parameters ?? { type: 'object', properties: {}, additionalProperties: false },
    strict: false,
    execute: async (args: any) => {
      const result = await fn(args);
      return typeof result === 'string' ? result : JSON.stringify(result);
    },
  });
}

/**
 * Build agent tools from the LaunchDarkly config tools map and a user-provided registry.
 *
 * Iterates over `configTools` (from `config.tools`), matches each against the
 * `registry`, and wraps them into openai-agents compatible tool objects.
 * Returns the tools array and a name mapping for tracking.
 */
export function buildAgentTools(
  toolHelper: any,
  configTools: { [toolName: string]: LDTool },
  registry: ToolRegistry,
  logger?: LDLogger,
): { agentTools: any[]; toolNameMap: Record<string, string> } {
  const agentTools: any[] = [];
  const toolNameMap: Record<string, string> = {};

  for (const [name, definition] of Object.entries(configTools)) {
    const toolFn = registry[name];
    if (toolFn !== undefined) {
      if (isAgentToolInstance(toolFn)) {
        const instanceName = (toolFn as any).name ?? name;
        toolNameMap[instanceName] = name;
      } else {
        toolNameMap[name] = name;
      }
      agentTools.push(registryValueToAgentTool(toolFn, toolHelper, definition));
      continue;
    }

    logger?.warn(
      `Tool '${name}' is defined in the AI config but was not found in ` +
        `the tool registry; skipping.`,
    );
  }
  return { agentTools, toolNameMap };
}
