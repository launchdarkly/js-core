import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { ChatResponse } from '../chat/types';
import { LDAIConfigKind, LDMessage } from '../config/types';
import { AgentGraphDefinition } from '../graph/AgentGraphDefinition';
import { StructuredResponse } from '../judge/types';
import { AgentGraphRunner, Runner } from './Runner';

/**
 * A registry of callable tools keyed by tool name.
 * Mirrors Python's `Dict[str, Callable]` — values are typically functions
 * that the provider invokes when the model requests a tool call.
 */
export type ToolRegistry = Record<string, (...args: any[]) => unknown>;

/**
 * Abstract base class for AI providers that implement chat model functionality.
 * This class provides the contract that all provider implementations must follow
 * to integrate with LaunchDarkly's tracking and configuration capabilities.
 *
 * Following the AICHAT spec recommendation to use base classes with non-abstract methods
 * for better extensibility and backwards compatibility.
 *
 * @deprecated Use the `Runner` interface instead. Provider implementations should
 * implement `Runner` (and optionally `AgentGraphRunner`) rather than extending this
 * abstract class. This class will be removed in a future major version.
 */
export abstract class AIProvider {
  protected readonly logger?: LDLogger;

  constructor(logger?: LDLogger) {
    this.logger = logger;
  }
  /**
   * Invoke the chat model with an array of messages.
   *
   * Default implementation takes no action and returns a placeholder response.
   * Provider implementations should override this method.
   *
   * @deprecated Use the `Runner` interface and its `run` method instead.
   * @param messages Array of LDMessage objects representing the conversation
   * @returns Promise that resolves to a ChatResponse containing the model's response
   */
  async invokeModel(_messages: LDMessage[]): Promise<ChatResponse> {
    this.logger?.warn('invokeModel not implemented by this provider');
    return {
      message: {
        role: 'assistant',
        content: '',
      },
      metrics: {
        success: false,
        usage: {
          total: 0,
          input: 0,
          output: 0,
        },
      },
    };
  }

  /**
   * Invoke the chat model with structured output support.
   *
   * Default implementation takes no action and returns a placeholder response.
   * Provider implementations should override this method.
   *
   * @deprecated Use the `Runner` interface and its `run` method with `outputType` instead.
   * @param messages Array of LDMessage objects representing the conversation
   * @param responseStructure Dictionary of output configurations keyed by output name
   * @returns Promise that resolves to a structured response
   */
  async invokeStructuredModel(
    _messages: LDMessage[],
    _responseStructure: Record<string, unknown>,
  ): Promise<StructuredResponse> {
    this.logger?.warn('invokeStructuredModel not implemented by this provider');
    return {
      data: {},
      rawResponse: '',
      metrics: {
        success: false,
        usage: {
          total: 0,
          input: 0,
          output: 0,
        },
      },
    };
  }

  // ============================================================================
  // Factory instance methods (Python AIProvider pattern)
  //
  // Provider packages override these to return a configured Runner for the
  // relevant mode. The default implementations log a warning and return
  // undefined, mirroring Python's base-class behaviour.
  // ============================================================================

  /**
   * Create a Runner for a completion or judge AI Config.
   *
   * Override in provider subclasses to return a configured {@link Runner}.
   * Default implementation logs a warning and returns `undefined`.
   *
   * @param config The completion or judge AI configuration.
   * @returns Promise resolving to a {@link Runner}, or `undefined` if this
   *   provider does not support model creation.
   */
  async createModel(_config: LDAIConfigKind): Promise<Runner | undefined> {
    this.logger?.warn('createModel not implemented by this provider');
    return undefined;
  }

  /**
   * Create a Runner for an agent AI Config.
   *
   * Override in provider subclasses to return a configured {@link Runner}.
   * Default implementation logs a warning and returns `undefined`.
   *
   * @param config The agent AI configuration.
   * @param tools Optional registry of callable tools.
   * @returns Promise resolving to a {@link Runner}, or `undefined` if this
   *   provider does not support agent creation.
   */
  async createAgent(_config: LDAIConfigKind, _tools?: ToolRegistry): Promise<Runner | undefined> {
    this.logger?.warn('createAgent not implemented by this provider');
    return undefined;
  }

  /**
   * Create an AgentGraphRunner for an agent graph definition.
   *
   * Override in provider subclasses to return a configured {@link AgentGraphRunner}.
   * Default implementation logs a warning and returns `undefined`.
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
    this.logger?.warn('createAgentGraph not implemented by this provider');
    return undefined;
  }

  // ============================================================================
  // Legacy static factory (retained for backward compatibility)
  // ============================================================================

  /**
   * Static method that constructs an instance of the provider.
   * Each provider implementation must provide their own static create method
   * that accepts an AIConfig and returns a configured instance.
   *
   * @deprecated Use the `createModel` factory method instead.
   * @param aiConfig The LaunchDarkly AI configuration
   * @param logger Optional logger for the provider
   * @returns Promise that resolves to a configured provider instance
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async create(aiConfig: LDAIConfigKind, logger?: LDLogger): Promise<AIProvider> {
    throw new Error('Provider implementations must override the static create method');
  }
}
