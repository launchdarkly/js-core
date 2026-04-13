import { Agent, BedrockModel, Message, TextBlock } from '@strands-agents/sdk';
import type { AgentResult, BedrockModelOptions } from '@strands-agents/sdk';
import { fromJSONSchema, z, type ZodType } from 'zod';

import {
  AIProvider,
  ChatResponse,
  type LDAIConfig,
  type LDAIMetrics,
  type LDLogger,
  LDMessage,
  type LDTokenUsage,
  StructuredResponse,
} from '@launchdarkly/server-sdk-ai';

/**
 * LaunchDarkly AI provider for Strands agents on Amazon Bedrock.
 * Extend with model invocation; {@link StrandsProvider.create} wires configuration from LDAI config.
 */
export class StrandsProvider extends AIProvider {
  private _agent: Agent;

  constructor(agent: Agent, logger?: LDLogger) {
    super(logger);
    this._agent = agent;
  }

  /**
   * Invoke the Strands agent with an array of messages.
   */
  async invokeModel(messages: LDMessage[]): Promise<ChatResponse> {
    const previousSystemPrompt = this._agent.systemPrompt;
    try {
      const systemTexts = messages.filter((m) => m.role === 'system').map((m) => m.content);
      if (systemTexts.length > 0) {
        this._agent.systemPrompt = systemTexts.join('\n\n');
      }

      const conversationMessages = messages.filter((m) => m.role !== 'system');
      if (conversationMessages.length === 0) {
        throw new Error('Strands agent invocation requires at least one user or assistant message');
      }

      this._agent.messages.splice(0, this._agent.messages.length);

      const strandsMessages = StrandsProvider.convertMessagesToStrands(conversationMessages);
      const result = await this._agent.invoke(strandsMessages);

      const content = result.toString();
      const metrics = StrandsProvider.getAIMetricsFromAgentResult(result);

      if (!content) {
        this.logger?.warn('Strands agent response has no text content');
        metrics.success = false;
      }

      return {
        message: {
          role: 'assistant',
          content,
        },
        metrics,
      };
    } catch (error) {
      this.logger?.warn('Strands agent invocation failed:', error);
      return {
        message: {
          role: 'assistant',
          content: '',
        },
        metrics: {
          success: false,
        },
      };
    } finally {
      this._agent.systemPrompt = previousSystemPrompt;
    }
  }
  /**
   * Invoke the Strands agent with structured output (Zod schema derived from JSON Schema).
   * Uses per-invocation {@link Agent.invoke} options `structuredOutputSchema`, matching Strands
   * structured-output flows.
   */
  async invokeStructuredModel(
    messages: LDMessage[],
    responseStructure: Record<string, unknown>,
  ): Promise<StructuredResponse> {
    const previousSystemPrompt = this._agent.systemPrompt;
    try {
      const systemTexts = messages.filter((m) => m.role === 'system').map((m) => m.content);
      if (systemTexts.length > 0) {
        this._agent.systemPrompt = systemTexts.join('\n\n');
      }

      const conversationMessages = messages.filter((m) => m.role !== 'system');
      if (conversationMessages.length === 0) {
        throw new Error('Strands agent invocation requires at least one user or assistant message');
      }

      this._agent.messages.splice(0, this._agent.messages.length);

      const strandsMessages = StrandsProvider.convertMessagesToStrands(conversationMessages);
      const zodSchema = StrandsProvider.responseStructureToZodSchema(responseStructure);

      const result = await this._agent.invoke(strandsMessages, {
        structuredOutputSchema: zodSchema,
      });

      const metrics = StrandsProvider.getAIMetricsFromAgentResult(result);
      const { structuredOutput } = result;

      if (structuredOutput === undefined) {
        this.logger?.warn('Strands agent structured response has no structured output');
        metrics.success = false;
        return {
          data: {},
          rawResponse: '',
          metrics,
        };
      }

      const data: Record<string, unknown> =
        structuredOutput !== null &&
        typeof structuredOutput === 'object' &&
        !Array.isArray(structuredOutput)
          ? (structuredOutput as Record<string, unknown>)
          : { value: structuredOutput as unknown };

      return {
        data,
        rawResponse: JSON.stringify(structuredOutput),
        metrics,
      };
    } catch (error) {
      this.logger?.warn('Strands agent structured invocation failed:', error);
      return {
        data: {},
        rawResponse: '',
        metrics: {
          success: false,
        },
      };
    } finally {
      this._agent.systemPrompt = previousSystemPrompt;
    }
  }

  /**
   * Build a Zod schema from LaunchDarkly's JSON Schema–style `responseStructure` for use with
   * Strands {@link Agent.invoke} (`structuredOutputSchema`). Uses Zod's `fromJSONSchema`.
   *
   * @param responseStructure JSON Schema object (e.g. from AI Config or judge evaluation schema)
   */
  static responseStructureToZodSchema(responseStructure: Record<string, unknown>): ZodType {
    if (!responseStructure || Object.keys(responseStructure).length === 0) {
      return z.record(z.string(), z.unknown());
    }
    return fromJSONSchema(responseStructure as Parameters<typeof fromJSONSchema>[0]);
  }

  /**
   * Static factory method to create a StrandsProvider from an AI configuration.
   */
  static async create(aiConfig: LDAIConfig, logger?: LDLogger): Promise<StrandsProvider> {
    const bedrockOptions = StrandsProvider.createBedrockModelOptions(aiConfig);
    const model = new BedrockModel(bedrockOptions);
    const agent = new Agent({ model, printer: false });
    return new StrandsProvider(agent, logger);
  }

  /**
   * Create Bedrock model options from a LaunchDarkly AI configuration.
   * This public helper method enables developers to initialize their own {@link BedrockModel}
   * using LaunchDarkly AI configurations.
   *
   * @param aiConfig The LaunchDarkly AI configuration
   * @returns Options suitable for `new BedrockModel(options)`
   */
  static createBedrockModelOptions(aiConfig: LDAIConfig): BedrockModelOptions {
    const modelId = aiConfig.model?.name || '';
    const parameters = aiConfig.model?.parameters || {};
    return StrandsProvider.mapParametersToBedrockOptions(parameters, modelId);
  }

  /**
   * Map LaunchDarkly model parameters to {@link BedrockModelOptions}.
   * Aligns with common LDAI parameter names (e.g. max_tokens, top_p) used across AI providers.
   *
   * @param parameters The LaunchDarkly model parameters object
   * @param modelId The Bedrock model identifier
   */
  static mapParametersToBedrockOptions(
    parameters: Record<string, unknown>,
    modelId: string,
  ): BedrockModelOptions {
    const options: BedrockModelOptions = { modelId };

    if (parameters.max_completion_tokens !== undefined) {
      options.maxTokens = parameters.max_completion_tokens as number;
    } else if (parameters.max_tokens !== undefined) {
      options.maxTokens = parameters.max_tokens as number;
    }
    if (parameters.temperature !== undefined) {
      options.temperature = parameters.temperature as number;
    }
    if (parameters.top_p !== undefined) {
      options.topP = parameters.top_p as number;
    }
    if (parameters.stop !== undefined) {
      options.stopSequences = parameters.stop as string[];
    }
    if (typeof parameters.region === 'string') {
      options.region = parameters.region;
    }
    if (typeof parameters.stream === 'boolean') {
      options.stream = parameters.stream;
    }

    return options;
  }

  /**
   * Convert LaunchDarkly messages to Strands {@link Message} instances.
   * This helper method enables developers to work directly with Strands message types
   * while maintaining compatibility with LaunchDarkly's standardized message format.
   * System messages should be supplied via {@link Agent.systemPrompt}, not in this array.
   *
   * @param messages User and assistant messages (typically excluding system role)
   */
  static convertMessagesToStrands(messages: LDMessage[]): Message[] {
    return messages.map((msg) => {
      const role = msg.role === 'user' ? 'user' : 'assistant';
      return new Message({
        role,
        content: [new TextBlock(msg.content)],
      });
    });
  }

  /**
   * Get AI metrics from a Strands {@link AgentResult}.
   * This method extracts token usage and success status from Strands agent results
   * and returns a LaunchDarkly {@link LDAIMetrics} object.
   *
   * @param result The result from {@link Agent.invoke}
   * @returns LDAIMetrics with success status and token usage
   *
   * @example
   * const result = await aiConfig.tracker.trackMetricsOf(
   *   StrandsProvider.getAIMetricsFromAgentResult,
   *   () => agent.invoke(messages)
   * );
   */
  static getAIMetricsFromAgentResult(result: AgentResult): LDAIMetrics {
    let usage: LDTokenUsage | undefined;
    const accumulated = result.metrics?.accumulatedUsage;
    if (accumulated) {
      usage = {
        total: accumulated.totalTokens ?? 0,
        input: accumulated.inputTokens ?? 0,
        output: accumulated.outputTokens ?? 0,
      };
    }

    let success = true;
    if (result.stopReason === 'cancelled' || result.stopReason === 'modelContextWindowExceeded') {
      success = false;
    }

    return {
      success,
      usage,
    };
  }
}
