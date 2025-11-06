import * as Mustache from 'mustache';

import { LDLogger } from '@launchdarkly/js-server-sdk-common';

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
   * @param samplingRate Sampling rate (0-1) to determine if evaluation should be processed (defaults to 1)
   * @returns Promise that resolves to evaluation results or undefined if not sampled
   */
  async evaluate(
    input: string,
    output: string,
    samplingRate: number = 1,
  ): Promise<JudgeResponse | undefined> {
    try {
      if (
        !this._aiConfig.evaluationMetricKeys ||
        this._aiConfig.evaluationMetricKeys.length === 0
      ) {
        this._logger?.warn(
          'Judge configuration is missing required evaluationMetricKeys',
          this._aiConfigTracker.getTrackData(),
        );
        return undefined;
      }

      if (!this._aiConfig.messages) {
        this._logger?.warn(
          'Judge configuration must include messages',
          this._aiConfigTracker.getTrackData(),
        );
        return undefined;
      }

      if (Math.random() > samplingRate) {
        this._logger?.debug(`Judge evaluation skipped due to sampling rate: ${samplingRate}`);
        return undefined;
      }

      const messages = this._constructEvaluationMessages(input, output);

      const response = await this._aiConfigTracker.trackMetricsOf(
        (result: StructuredResponse) => result.metrics,
        () => this._aiProvider.invokeStructuredModel(messages, this._evaluationResponseStructure),
      );

      let { success } = response.metrics;

      const evals = this._parseEvaluationResponse(response.data);

      if (Object.keys(evals).length !== this._aiConfig.evaluationMetricKeys.length) {
        this._logger?.warn(
          'Judge evaluation did not return all evaluations',
          this._aiConfigTracker.getTrackData(),
        );
        success = false;
      }

      return {
        evals,
        success,
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
   * Parses the structured evaluation response from the AI provider.
   */
  private _parseEvaluationResponse(data: Record<string, unknown>): Record<string, EvalScore> {
    const evaluations = data.evaluations as Record<string, unknown>;
    const results: Record<string, EvalScore> = {};

    if (!data.evaluations || typeof data.evaluations !== 'object') {
      this._logger?.warn('Invalid response: missing or invalid evaluations object');
      return results;
    }

    this._aiConfig.evaluationMetricKeys.forEach((metricKey) => {
      const evaluation = evaluations[metricKey];

      if (!evaluation || typeof evaluation !== 'object') {
        this._logger?.warn(
          `Missing evaluation for metric key: ${metricKey}`,
          this._aiConfigTracker.getTrackData(),
        );
        return;
      }

      const evalData = evaluation as Record<string, unknown>;

      if (typeof evalData.score !== 'number' || evalData.score < 0 || evalData.score > 1) {
        this._logger?.warn(
          `Invalid score evaluated for ${metricKey}: ${evalData.score}. Score must be a number between 0 and 1 inclusive`,
          this._aiConfigTracker.getTrackData(),
        );
        return;
      }

      if (typeof evalData.reasoning !== 'string') {
        this._logger?.warn(
          `Invalid reasoning evaluated for ${metricKey}: ${evalData.reasoning}. Reasoning must be a string`,
          this._aiConfigTracker.getTrackData(),
        );
        return;
      }

      results[metricKey] = {
        score: evalData.score,
        reasoning: evalData.reasoning,
        judgeConfigKey: this._aiConfig.key,
      };
    });

    return results;
  }
}
