import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAIJudgeConfig, LDMessage } from '../config/types';
import { RunnerResult } from '../model/types';
import { Runner } from '../providers/Runner';
import { LDJudgeResult } from './types';

const EVALUATION_SCHEMA = {
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
} as const;

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
    private readonly _runner: Runner,
    private readonly _sampleRate: number = 1.0,
    logger?: LDLogger,
  ) {
    this._logger = logger;
  }

  /**
   * The default sampling rate baked in at construction. Used by `evaluate` /
   * `evaluateMessages` when no per-call rate is supplied.
   */
  get sampleRate(): number {
    return this._sampleRate;
  }

  /**
   * Gets the evaluation metric key from the judge AI config.
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
    return undefined;
  }

  /**
   * Evaluates an AI response using the judge's configuration.
   *
   * @param input The input prompt or question that was provided to the AI
   * @param output The AI-generated response to be evaluated
   * @param samplingRate Sampling rate (0-1) to determine if evaluation should be processed.
   *   When omitted, the Judge's constructor-default rate is used. An explicit `0` overrides
   *   the default — only `undefined` falls through.
   * @returns Promise that resolves to evaluation results
   */
  async evaluate(input: string, output: string, samplingRate?: number): Promise<LDJudgeResult> {
    const effectiveRate = samplingRate ?? this._sampleRate;
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

      if (Math.random() > effectiveRate) {
        this._logger?.debug(`Judge evaluation skipped due to sampling rate: ${effectiveRate}`);
        return result;
      }

      result.sampled = true;

      const evaluationInput = this._buildEvaluationInput(input, output);

      const response = await tracker.trackMetricsOf(
        (r: RunnerResult) => r.metrics,
        () => this._runner.run(evaluationInput, EVALUATION_SCHEMA),
      );

      const evalResult = this._parseEvaluationResponse(response.parsed);

      if (!evalResult) {
        this._logger?.warn(
          `Could not parse evaluation response: ${JSON.stringify(response.parsed)}`,
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
   * Evaluates an AI response from chat messages and a runner result.
   *
   * Each message is rendered as `<role>: <content>` so the judge model can
   * distinguish speakers in the message history. Messages are joined with a
   * single newline.
   *
   * @param messages Array of messages representing the conversation history
   * @param response The runner result containing the AI-generated content to evaluate
   * @param samplingRatio Sampling ratio (0-1). When omitted, the Judge's
   *   constructor-default rate is used.
   * @returns Promise that resolves to evaluation results
   */
  async evaluateMessages(
    messages: LDMessage[],
    response: RunnerResult,
    samplingRatio?: number,
  ): Promise<LDJudgeResult> {
    const input =
      messages.length === 0
        ? ''
        : messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n');
    const output = response.content;

    return this.evaluate(input, output, samplingRatio);
  }

  /**
   * Returns the AI Config used by this judge.
   */
  getAIConfig(): LDAIJudgeConfig {
    return this._aiConfig;
  }

  /**
   * Returns the runner used by this judge.
   */
  getRunner(): Runner {
    return this._runner;
  }

  /**
   * Builds the evaluation input string passed to the runner.
   *
   * Combines the original prompt and the response into a single, well-known
   * format the judge model is expected to evaluate.
   */
  private _buildEvaluationInput(input: string, output: string): string {
    return `MESSAGE HISTORY:\n${input}\n\nRESPONSE TO EVALUATE:\n${output}`;
  }

  /**
   * Parses the structured evaluation response. Expects top-level {score, reasoning}.
   * Returns score and reasoning, or undefined if parsing fails.
   */
  private _parseEvaluationResponse(
    data: Record<string, unknown> | undefined,
  ): { score: number; reasoning: string } | undefined {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
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
