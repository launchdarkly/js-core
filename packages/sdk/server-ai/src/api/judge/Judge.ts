import Mustache from 'mustache';

import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { ChatResponse } from '../chat/types';
import { LDAIJudgeConfig, LDMessage } from '../config/types';
import { AIProvider } from '../providers/AIProvider';
import { LDJudgeResult, StructuredResponse } from './types';

const EVALUATION_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    score: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Score between 0.0 and 1.0.',
    },
    reasoning: {
      type: 'string',
      description: 'Reasoning behind the score.',
    },
  },
  required: ['score', 'reasoning'],
  additionalProperties: false,
};

/**
 * Judge implementation that handles evaluation functionality and conversation management.
 *
 * According to the AIEval spec, judges are AI Configs with mode: "judge" that evaluate
 * other AI Configs using structured output.
 */
export class Judge {
  private readonly _logger?: LDLogger;

  constructor(
    private readonly _aiConfig: LDAIJudgeConfig,
    private readonly _aiProvider: AIProvider,
    logger?: LDLogger,
  ) {
    this._logger = logger;
  }

  /**
   * Gets the evaluation metric key, prioritizing evaluationMetricKey over evaluationMetricKeys.
   * Falls back to the first valid (non-empty, non-whitespace) value in evaluationMetricKeys if evaluationMetricKey is not provided.
   * Treats empty strings and whitespace-only strings as invalid.
   * @returns The evaluation metric key, or undefined if not available
   */
  private _getEvaluationMetricKey(): string | undefined {
    if (
      this._aiConfig.evaluationMetricKey &&
      this._aiConfig.evaluationMetricKey.trim().length > 0
    ) {
      return this._aiConfig.evaluationMetricKey.trim();
    }
    if (this._aiConfig.evaluationMetricKeys && this._aiConfig.evaluationMetricKeys.length > 0) {
      const validKey = this._aiConfig.evaluationMetricKeys.find(
        (key) => key && key.trim().length > 0,
      );
      return validKey ? validKey.trim() : undefined;
    }
    return undefined;
  }

  /**
   * Evaluates an AI response using the judge's configuration.
   *
   * @param input The input prompt or question that was provided to the AI
   * @param output The AI-generated response to be evaluated
   * @param samplingRate Sampling rate (0-1) to determine if evaluation should be processed (defaults to 1)
   * @returns Promise that resolves to evaluation results
   */
  async evaluate(input: string, output: string, samplingRate: number = 1): Promise<LDJudgeResult> {
    const result: LDJudgeResult = {
      success: false,
      sampled: false,
      judgeConfigKey: this._aiConfig.key,
    };

    const tracker = this._aiConfig.createTracker!();
    try {
      const evaluationMetricKey = this._getEvaluationMetricKey();
      if (!evaluationMetricKey) {
        this._logger?.warn(
          'Judge configuration is missing required evaluation metric key',
          tracker.getTrackData(),
        );
        result.sampled = true;
        result.errorMessage = 'Judge configuration is missing required evaluation metric key';
        return result;
      }

      if (!this._aiConfig.messages) {
        this._logger?.warn('Judge configuration must include messages', tracker.getTrackData());
        result.sampled = true;
        result.errorMessage = 'Judge configuration must include messages';
        return result;
      }

      if (Math.random() > samplingRate) {
        this._logger?.debug(`Judge evaluation skipped due to sampling rate: ${samplingRate}`);
        return result;
      }

      result.sampled = true;

      const messages = this._constructEvaluationMessages(input, output);

      const response = await tracker.trackMetricsOf(
        (r: StructuredResponse) => r.metrics,
        () => this._aiProvider.invokeStructuredModel(messages, EVALUATION_SCHEMA),
      );

      const evalResult = this._parseEvaluationResponse(response.data);

      if (!evalResult) {
        this._logger?.warn(
          `Could not parse evaluation response: ${JSON.stringify(response.data)}`,
          tracker.getTrackData(),
        );
        return result;
      }

      return {
        ...result,
        success: response.metrics.success,
        score: evalResult.score,
        reasoning: evalResult.reasoning,
        metricKey: evaluationMetricKey,
      };
    } catch (error) {
      this._logger?.error('Judge evaluation failed:', error);
      result.sampled = true;
      result.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return result;
    }
  }

  /**
   * Evaluates an AI response from chat messages and response.
   *
   * @param messages Array of messages representing the conversation history
   * @param response The AI response to be evaluated
   * @param samplingRatio Sampling ratio (0-1) to determine if evaluation should be processed (defaults to 1)
   * @returns Promise that resolves to evaluation results
   */
  async evaluateMessages(
    messages: LDMessage[],
    response: ChatResponse,
    samplingRatio: number = 1,
  ): Promise<LDJudgeResult> {
    const input = messages.length === 0 ? '' : messages.map((msg) => msg.content).join('\r\n');
    const output = response.message.content;

    return this.evaluate(input, output, samplingRatio);
  }

  /**
   * Returns the AI Config used by this judge.
   */
  getAIConfig(): LDAIJudgeConfig {
    return this._aiConfig;
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
   * Interpolates message content with variables using Mustache templating.
   */
  private _interpolateMessage(content: string, variables: Record<string, string>): string {
    return Mustache.render(content, variables, undefined, { escape: (item: any) => item });
  }

  /**
   * Parses the structured evaluation response. Expects top-level {score, reasoning}.
   * Returns score and reasoning, or undefined if parsing fails.
   */
  private _parseEvaluationResponse(
    data: Record<string, unknown>,
  ): { score: number; reasoning: string } | undefined {
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    if (typeof data.score !== 'number' || data.score < 0 || data.score > 1) {
      return undefined;
    }

    if (typeof data.reasoning !== 'string') {
      return undefined;
    }

    return {
      score: data.score,
      reasoning: data.reasoning,
    };
  }
}
