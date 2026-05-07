import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAIAgentConfig, LDAICompletionConfig, LDAIJudgeConfig } from '../config/types';
import { AgentGraphDefinition } from '../graph/AgentGraphDefinition';
import { AgentGraphRunner, Runner } from './Runner';

/**
 * A registry of callable tools keyed by tool name.
 * Mirrors Python's `Dict[str, Callable]` — values are typically functions
 * that the provider invokes when the model requests a tool call.
 */
export type ToolRegistry = Record<string, (...args: any[]) => unknown>;

/**
 * Abstract base class for AI providers.
 *
 * An `AIProvider` is a per-provider factory: it is instantiated once per
 * provider package and is responsible for constructing focused runtime
 * capability objects via {@link createModel}, {@link createAgent}, and
 * {@link createAgentGraph}.
 *
 * Provider packages subclass `AIProvider` and override the methods they
 * support. The default implementations return `undefined`, mirroring Python's
 * base-class behaviour, so providers only need to implement the modes they
 * actually support.
 */
export abstract class AIProvider {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  protected _logger?: LDLogger;

  constructor(logger?: LDLogger) {
    this._logger = logger;
  }
  /**
   * Create a Runner for a completion or judge AI Config.
   *
   * Override in provider subclasses to return a configured {@link Runner}.
   * Default implementation returns `undefined`.
   *
   * @param config The completion or judge AI configuration.
   * @returns Promise resolving to a {@link Runner}, or `undefined` if this
   *   provider does not support model creation.
   */
  async createModel(_config: LDAICompletionConfig | LDAIJudgeConfig): Promise<Runner | undefined> {
    return undefined;
  }

  /**
   * Create a Runner for an agent AI Config.
   *
   * Override in provider subclasses to return a configured {@link Runner}.
   * Default implementation returns `undefined`.
   *
   * @param config The agent AI configuration.
   * @param tools Optional registry of callable tools.
   * @returns Promise resolving to a {@link Runner}, or `undefined` if this
   *   provider does not support agent creation.
   */
  async createAgent(_config: LDAIAgentConfig, _tools?: ToolRegistry): Promise<Runner | undefined> {
    return undefined;
  }

  /**
   * Create an AgentGraphRunner for an agent graph definition.
   *
   * Override in provider subclasses to return a configured {@link AgentGraphRunner}.
   * Default implementation returns `undefined`.
   *
   * @param graphDef The agent graph definition.
   * @param tools Optional registry of callable tools.
   * @returns Promise resolving to an {@link AgentGraphRunner}, or `undefined` if
   *   this provider does not support graph execution.
   */
  async createAgentGraph(
    _graphDef: AgentGraphDefinition,
    _tools?: ToolRegistry,
  ): Promise<AgentGraphRunner | undefined> {
    return undefined;
  }
}
