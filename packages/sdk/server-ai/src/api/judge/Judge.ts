import { internal, LDLogger } from '@launchdarkly/js-server-sdk-common';

import { ChatResponse } from '../chat/types';
import { LDAIConfigTracker } from '../config/LDAIConfigTracker';
import { LDAIJudgeConfig, LDMessage } from '../config/types';
import { AIProvider } from '../providers/AIProvider';
import { EvaluationSchemaBuilder } from './EvaluationSchemaBuilder';
import { EvalScore, JudgeResponse, StructuredResponse } from './types';

/**
 * Judge implementation that handles evaluation functionality and conversation management.
 *
 * According to the AIEval spec, judges are AI Configs with mode: "judge" that evaluate
 * other AI Configs using structured output.
 */
export class Judge {
  private readonly _logger?: LDLogger;
  private readonly _evaluationResponseStructure: Record<string, unknown>;

  constructor(
    private readonly _aiConfig: LDAIJudgeConfig,
    private readonly _aiConfigTracker: LDAIConfigTracker,
    private readonly _aiProvider: AIProvider,
    logger?: LDLogger,
  ) {
    this._logger = logger;
    this._evaluationResponseStructure = EvaluationSchemaBuilder.build(
      this._aiConfig.evaluationMetricKeys,
    );
  }

  /**
   * Evaluates an AI response using the judge's configuration.
   *
   * @param input The input prompt or question that was provided to the AI
   * @param output The AI-generated response to be evaluated
   * @param samplingRatio Sampling ratio (0-1) to determine if evaluation should be processed (defaults to 1)
   * @returns Promise that resolves to evaluation results or undefined if not sampled
   */
  async evaluate(
    input: string,
    output: string,
    samplingRatio: number = 1,
  ): Promise<JudgeResponse | undefined> {
    try {
      // Apply sampling
      if (!internal.shouldSample(samplingRatio)) {
        this._logger?.debug(`Judge evaluation skipped due to sampling ratio: ${samplingRatio}`);
        return undefined;
      }

      // Check if judge configuration has evaluation metric keys
      if (
        !this._aiConfig.evaluationMetricKeys ||
        this._aiConfig.evaluationMetricKeys.length === 0
      ) {
        this._logger?.warn('Judge configuration is missing required evaluationMetricKeys');
        return undefined;
      }

      // Check if judge configuration has messages before proceeding
      if (!this._aiConfig.messages) {
        this._logger?.warn('Judge configuration must include messages');
        return undefined;
      }

      // Construct evaluation messages by combining judge's config messages with input/output
      const messages = this._constructEvaluationMessages(input, output);

      // Delegate to provider-specific implementation with tracking
      const response = await this._aiConfigTracker.trackMetricsOf(
        (result: StructuredResponse) => result.metrics,
        () => this._aiProvider.invokeStructuredModel(messages, this._evaluationResponseStructure),
      );

      // Parse the structured response
      const evals = this._parseEvaluationResponse(
        this._aiConfig.evaluationMetricKeys,
        response.data,
      );

      if (evals === null) {
        return {
          evals: {},
          success: false,
          error: 'Failed to parse evaluation response: invalid data format',
        };
      }

      return {
        evals,
        success: true,
      };
    } catch (error) {
      this._logger?.error('Judge evaluation failed:', error);
      return {
        evals: {},
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Evaluates an AI response from chat messages and response.
   *
   * @param messages Array of messages representing the conversation history
   * @param response The AI response to be evaluated
   * @param samplingRatio Sampling ratio (0-1) to determine if evaluation should be processed (defaults to 1)
   * @returns Promise that resolves to evaluation results or undefined if not sampled
   */
  async evaluateMessages(
    messages: LDMessage[],
    response: ChatResponse,
    samplingRatio: number = 1,
  ): Promise<JudgeResponse | undefined> {
    // Convert messages to text and extract output from response
    const input = messages.length === 0 ? '' : messages.map((msg) => msg.content).join('\n');
    const output = response.message.content;

    // Delegate to standard evaluate method
    return this.evaluate(input, output, samplingRatio);
  }

  /**
   * Returns the AI Config used by this judge.
   */
  getAIConfig(): LDAIJudgeConfig {
    return this._aiConfig;
  }

  /**
   * Returns the tracker associated with this judge.
   */
  getTracker(): LDAIConfigTracker {
    return this._aiConfigTracker;
  }

  /**
   * Returns the AI provider used by this judge.
   */
  getProvider(): AIProvider {
    return this._aiProvider;
  }

  /**
   * Constructs evaluation messages by combining judge's config messages with input/output.
   */
  private _constructEvaluationMessages(input: string, output: string): LDMessage[] {
    // Create a copy of the judge's messages and interpolate input/output variables
    const messages: LDMessage[] = this._aiConfig.messages!.map((msg) => ({
      ...msg,
      content: this._interpolateMessage(msg.content, {
        message_history: input,
        response_to_evaluate: output,
      }),
    }));

    return messages;
  }

  /**
   * Interpolates message content with variables.
   */
  private _interpolateMessage(content: string, variables: Record<string, string>): string {
    let interpolated = content;

    // Simple variable interpolation - in a real implementation, this would use a proper template engine
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      interpolated = interpolated.replace(new RegExp(placeholder, 'g'), value);
    });

    return interpolated;
  }

  /**
   * Parses the structured evaluation response from the AI provider.
   */
  private _parseEvaluationResponse(
    evaluationMetricKeys: string[],
    data: Record<string, unknown>,
  ): Record<string, EvalScore> | null {
    // Validate that the data has the required evaluations structure
    if (!data.evaluations || typeof data.evaluations !== 'object') {
      this._logger?.error('Invalid response: missing or invalid evaluations object');
      return null;
    }

    const evaluations = data.evaluations as Record<string, unknown>;
    const results: Record<string, EvalScore> = {};

    // Process each expected evaluation metric key
    evaluationMetricKeys.forEach((metricKey) => {
      const evaluation = evaluations[metricKey];

      if (!evaluation || typeof evaluation !== 'object') {
        this._logger?.warn(`Missing evaluation for metric key: ${metricKey}`);
        return;
      }

      const evalData = evaluation as Record<string, unknown>;

      // Validate score
      if (typeof evalData.score !== 'number' || evalData.score < 0 || evalData.score > 1) {
        this._logger?.error(
          `Invalid score for ${metricKey}: ${evalData.score}. Score must be a number between 0 and 1`,
        );
        return;
      }

      // Validate reasoning
      if (typeof evalData.reasoning !== 'string') {
        this._logger?.error(`Invalid reasoning for ${metricKey}: reasoning must be a string`);
        return;
      }

      // Create the EvalScore object
      results[metricKey] = {
        score: evalData.score,
        reasoning: evalData.reasoning,
      };
    });

    // Return null if no valid evaluations were found
    if (Object.keys(results).length === 0) {
      this._logger?.error('No valid evaluations found in response');
      return null;
    }

    return results;
  }
}
