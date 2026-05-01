import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfigTracker } from '../src/api/config/LDAIConfigTracker';
import { LDAIJudgeConfig, LDMessage } from '../src/api/config/types';
import { Judge } from '../src/api/judge/Judge';
import { StructuredResponse } from '../src/api/judge/types';
import { AIProvider } from '../src/api/providers/AIProvider';

describe('Judge', () => {
  let mockProvider: jest.Mocked<AIProvider>;
  let mockTracker: jest.Mocked<LDAIConfigTracker>;
  let mockLogger: jest.Mocked<LDLogger>;
  let judgeConfig: LDAIJudgeConfig;

  const mockTrackData = {
    variationKey: 'test-variation',
    configKey: 'test-config',
    version: 1,
  };

  beforeEach(() => {
    mockProvider = {
      invokeStructuredModel: jest.fn(),
    } as any;

    mockTracker = {
      trackMetricsOf: jest.fn(),
      getTrackData: jest.fn().mockReturnValue(mockTrackData),
    } as any;

    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    judgeConfig = {
      key: 'test-judge',
      enabled: true,
      messages: [
        { role: 'system', content: 'You are a helpful judge that evaluates AI responses.' },
        {
          role: 'user',
          content:
            'Evaluate and report scores for important metrics: Input: {{message_history}}, Output: {{response_to_evaluate}}',
        },
      ],
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      createTracker: () => mockTracker,
      evaluationMetricKey: 'relevance',
    };
  });

  describe('constructor', () => {
    it('initializes with proper configuration', () => {
      const judge = new Judge(judgeConfig, mockProvider, 1.0, mockLogger);

      expect(judge).toBeDefined();
    });

    it('defaults sampleRate to 1.0 when omitted', () => {
      const judge = new Judge(judgeConfig, mockProvider);
      expect(judge.sampleRate).toBe(1.0);
    });

    it('exposes the sampleRate provided to the constructor', () => {
      const judge = new Judge(judgeConfig, mockProvider, 0.25, mockLogger);
      expect(judge.sampleRate).toBe(0.25);
    });

    it('honors a sampleRate of 0', () => {
      const judge = new Judge(judgeConfig, mockProvider, 0, mockLogger);
      expect(judge.sampleRate).toBe(0);
    });
  });

  describe('sampling fallback in evaluate()', () => {
    it('uses the constructor sampleRate when no per-call rate is supplied', async () => {
      // Force sampling to skip: math.random() returns 0.6, sampleRate 0.5 → 0.6 > 0.5 → skip.
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.6);

      const judge = new Judge(judgeConfig, mockProvider, 0.5, mockLogger);
      const result = await judge.evaluate('input', 'output');

      // Skipped due to sampling: sampled stays false (default), no provider call.
      expect(result.sampled).toBe(false);
      expect(mockProvider.invokeStructuredModel).not.toHaveBeenCalled();

      randomSpy.mockRestore();
    });

    it('honors an explicit per-call samplingRate of 0 over the constructor default', async () => {
      // Even with Math.random() at 0, samplingRate=0 means 0 > 0 is false — skip path is
      // `Math.random() > rate`, so rate=0 + random=0 does NOT skip. Use random=0.5.
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Constructor rate is 1.0 (would normally always sample); per-call 0 overrides to skip.
      const judge = new Judge(judgeConfig, mockProvider, 1.0, mockLogger);
      const result = await judge.evaluate('input', 'output', 0);

      expect(result.sampled).toBe(false);
      expect(mockProvider.invokeStructuredModel).not.toHaveBeenCalled();

      randomSpy.mockRestore();
    });

    it('per-call samplingRate of undefined falls through to the constructor default', async () => {
      // Constructor 0 (always skip), per-call undefined → effective rate 0.
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const judge = new Judge(judgeConfig, mockProvider, 0, mockLogger);
      const result = await judge.evaluate('input', 'output', undefined);

      expect(result.sampled).toBe(false);
      expect(mockProvider.invokeStructuredModel).not.toHaveBeenCalled();

      randomSpy.mockRestore();
    });
  });

  describe('evaluate', () => {
    let judge: Judge;

    beforeEach(() => {
      judge = new Judge(judgeConfig, mockProvider, 1.0, mockLogger);
    });

    it('evaluates AI response successfully', async () => {
      const mockStructuredResponse: StructuredResponse = {
        data: {
          score: 0.8,
          reasoning: 'The response is relevant to the question',
        },
        rawResponse: JSON.stringify({
          score: 0.8,
          reasoning: 'The response is relevant to the question',
        }),
        metrics: {
          success: true,
          usage: {
            total: 100,
            input: 50,
            output: 50,
          },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockProvider.invokeStructuredModel.mockResolvedValue(mockStructuredResponse);

      const result = await judge.evaluate(
        'What is the capital of France?',
        'Paris is the capital of France.',
      );

      expect(result).toEqual({
        score: 0.8,
        reasoning: 'The response is relevant to the question',
        metricKey: 'relevance',
        success: true,
        sampled: true,
        judgeConfigKey: 'test-judge',
      });

      expect(mockProvider.invokeStructuredModel).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: 'You are a helpful judge that evaluates AI responses.',
          }),
          expect.objectContaining({
            role: 'user',
            content:
              'Evaluate and report scores for important metrics: Input: What is the capital of France?, Output: Paris is the capital of France.',
          }),
        ]),
        expect.any(Object), // evaluation response structure
      );
    });

    it('returns evaluation result with correct evaluationMetricKey for tracker integration', async () => {
      const mockStructuredResponse: StructuredResponse = {
        data: {
          score: 0.85,
          reasoning: 'Highly relevant response',
        },
        rawResponse: JSON.stringify({
          score: 0.85,
          reasoning: 'Highly relevant response',
        }),
        metrics: {
          success: true,
          usage: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockProvider.invokeStructuredModel.mockResolvedValue(mockStructuredResponse);

      const result = await judge.evaluate('test input', 'test output');

      expect(result).toBeDefined();
      expect(result.score).toBe(0.85);
      expect(result.metricKey).toBe('relevance');
      expect(result.judgeConfigKey).toBe('test-judge');
      expect(result.success).toBe(true);
      expect(result.sampled).toBe(true);
    });

    it('handles sampling rate correctly', async () => {
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.3);

      const mockStructuredResponse: StructuredResponse = {
        data: {
          score: 0.8,
          reasoning: 'Good',
        },
        rawResponse: JSON.stringify({
          score: 0.8,
          reasoning: 'Good',
        }),
        metrics: {
          success: true,
          usage: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockProvider.invokeStructuredModel.mockResolvedValue(mockStructuredResponse);

      const result = await judge.evaluate('test input', 'test output', 0.5);

      expect(result).toBeDefined();
      expect(result.sampled).toBe(true);
      expect(mockProvider.invokeStructuredModel).toHaveBeenCalled();

      Math.random = originalRandom;
    });

    it('returns unsampled result when skipped by sampling', async () => {
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.8);

      const result = await judge.evaluate('test input', 'test output', 0.5);

      expect(result).toEqual({
        success: false,
        sampled: false,
        judgeConfigKey: 'test-judge',
      });
      expect(mockProvider.invokeStructuredModel).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Judge evaluation skipped due to sampling rate: 0.5',
      );

      Math.random = originalRandom;
    });

    it('returns error result when evaluationMetricKey and evaluationMetricKeys are both missing', async () => {
      const configWithoutMetrics: LDAIJudgeConfig = {
        ...judgeConfig,
        evaluationMetricKey: undefined,
        evaluationMetricKeys: [],
      };
      const judgeWithoutMetrics = new Judge(configWithoutMetrics, mockProvider, 1.0, mockLogger);

      const result = await judgeWithoutMetrics.evaluate('test input', 'test output');

      expect(result).toEqual({
        success: false,
        sampled: true,
        errorMessage: 'Judge configuration is missing required evaluation metric key',
        judgeConfigKey: 'test-judge',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Judge configuration is missing required evaluation metric key',
        mockTrackData,
      );
    });

    it('uses evaluationMetricKey when provided', async () => {
      const configWithSingleKey: LDAIJudgeConfig = {
        ...judgeConfig,
        evaluationMetricKey: 'relevance',
        evaluationMetricKeys: undefined,
      };
      const judgeWithSingleKey = new Judge(configWithSingleKey, mockProvider, 1.0, mockLogger);

      const mockStructuredResponse: StructuredResponse = {
        data: {
          score: 0.8,
          reasoning: 'The response is relevant',
        },
        rawResponse: JSON.stringify({
          score: 0.8,
          reasoning: 'The response is relevant',
        }),
        metrics: {
          success: true,
          usage: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockProvider.invokeStructuredModel.mockResolvedValue(mockStructuredResponse);

      const result = await judgeWithSingleKey.evaluate('test input', 'test output');

      expect(result).toEqual({
        score: 0.8,
        reasoning: 'The response is relevant',
        metricKey: 'relevance',
        success: true,
        sampled: true,
        judgeConfigKey: 'test-judge',
      });
    });

    it('falls back to first value in evaluationMetricKeys when evaluationMetricKey is not provided', async () => {
      const configWithLegacyKeys: LDAIJudgeConfig = {
        ...judgeConfig,
        evaluationMetricKey: undefined,
        evaluationMetricKeys: ['relevance', 'accuracy'],
      };
      const judgeWithLegacyKeys = new Judge(configWithLegacyKeys, mockProvider, 1.0, mockLogger);

      const mockStructuredResponse: StructuredResponse = {
        data: {
          score: 0.8,
          reasoning: 'The response is relevant',
        },
        rawResponse: JSON.stringify({
          score: 0.8,
          reasoning: 'The response is relevant',
        }),
        metrics: {
          success: true,
          usage: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockProvider.invokeStructuredModel.mockResolvedValue(mockStructuredResponse);

      const result = await judgeWithLegacyKeys.evaluate('test input', 'test output');

      expect(result).toEqual({
        score: 0.8,
        reasoning: 'The response is relevant',
        metricKey: 'relevance',
        success: true,
        sampled: true,
        judgeConfigKey: 'test-judge',
      });
    });

    it('skips empty and whitespace-only strings in evaluationMetricKeys array', async () => {
      const configWithInvalidKeys: LDAIJudgeConfig = {
        ...judgeConfig,
        evaluationMetricKey: undefined,
        evaluationMetricKeys: ['', '   ', 'relevance', 'accuracy'],
      };
      const judgeWithInvalidKeys = new Judge(configWithInvalidKeys, mockProvider, 1.0, mockLogger);

      const mockStructuredResponse: StructuredResponse = {
        data: {
          score: 0.8,
          reasoning: 'The response is relevant',
        },
        rawResponse: JSON.stringify({
          score: 0.8,
          reasoning: 'The response is relevant',
        }),
        metrics: {
          success: true,
          usage: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockProvider.invokeStructuredModel.mockResolvedValue(mockStructuredResponse);

      const result = await judgeWithInvalidKeys.evaluate('test input', 'test output');

      // Should skip empty and whitespace strings, use first valid value
      expect(result).toEqual({
        score: 0.8,
        reasoning: 'The response is relevant',
        metricKey: 'relevance',
        success: true,
        sampled: true,
        judgeConfigKey: 'test-judge',
      });
    });

    it('prioritizes evaluationMetricKey over evaluationMetricKeys when both are provided', async () => {
      const configWithBoth: LDAIJudgeConfig = {
        ...judgeConfig,
        evaluationMetricKey: 'helpfulness',
        evaluationMetricKeys: ['relevance', 'accuracy'],
      };
      const judgeWithBoth = new Judge(configWithBoth, mockProvider, 1.0, mockLogger);

      const mockStructuredResponse: StructuredResponse = {
        data: {
          score: 0.7,
          reasoning: 'The response is helpful',
        },
        rawResponse: JSON.stringify({
          score: 0.7,
          reasoning: 'The response is helpful',
        }),
        metrics: {
          success: true,
          usage: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockProvider.invokeStructuredModel.mockResolvedValue(mockStructuredResponse);

      const result = await judgeWithBoth.evaluate('test input', 'test output');

      expect(result).toEqual({
        score: 0.7,
        reasoning: 'The response is helpful',
        metricKey: 'helpfulness',
        success: true,
        sampled: true,
        judgeConfigKey: 'test-judge',
      });
    });

    it('returns error result when messages are missing', async () => {
      const configWithoutMessages: LDAIJudgeConfig = {
        ...judgeConfig,
        messages: undefined,
      };
      const judgeWithoutMessages = new Judge(configWithoutMessages, mockProvider, 1.0, mockLogger);

      const result = await judgeWithoutMessages.evaluate('test input', 'test output');

      expect(result).toEqual({
        success: false,
        sampled: true,
        errorMessage: 'Judge configuration must include messages',
        judgeConfigKey: 'test-judge',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Judge configuration must include messages',
        mockTrackData,
      );
    });

    it('returns result with success false when response has no score or reasoning', async () => {
      const mockStructuredResponse: StructuredResponse = {
        data: {},
        rawResponse: '{}',
        metrics: {
          success: true,
          usage: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockProvider.invokeStructuredModel.mockResolvedValue(mockStructuredResponse);

      const result = await judge.evaluate('test input', 'test output');

      expect(result).toEqual({
        success: false,
        sampled: true,
        judgeConfigKey: 'test-judge',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Could not parse evaluation response: {}',
        mockTrackData,
      );
    });

    it('returns result with success false when response structure is malformed', async () => {
      const mockStructuredResponse: StructuredResponse = {
        data: {
          evaluations: {
            relevance: { score: 0.8, reasoning: 'Good' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            relevance: { score: 0.8, reasoning: 'Good' },
          },
        }),
        metrics: {
          success: true,
          usage: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockProvider.invokeStructuredModel.mockResolvedValue(mockStructuredResponse);

      const result = await judge.evaluate('test input', 'test output');

      expect(result).toEqual({
        success: false,
        sampled: true,
        judgeConfigKey: 'test-judge',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not parse evaluation response:'),
        mockTrackData,
      );
    });

    it('handles provider errors gracefully', async () => {
      const error = new Error('Provider error');
      mockTracker.trackMetricsOf.mockRejectedValue(error);

      const result = await judge.evaluate('test input', 'test output');

      expect(result).toEqual({
        success: false,
        sampled: true,
        errorMessage: 'Provider error',
        judgeConfigKey: 'test-judge',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Judge evaluation failed:', error);
    });

    it('handles non-Error exceptions', async () => {
      mockTracker.trackMetricsOf.mockRejectedValue('String error');

      const result = await judge.evaluate('test input', 'test output');

      expect(result).toEqual({
        success: false,
        sampled: true,
        errorMessage: 'Unknown error',
        judgeConfigKey: 'test-judge',
      });
    });
  });

  describe('evaluateMessages', () => {
    let judge: Judge;

    beforeEach(() => {
      judge = new Judge(judgeConfig, mockProvider, 1.0, mockLogger);
    });

    it('evaluates messages and response successfully', async () => {
      const messages: LDMessage[] = [
        { role: 'user', content: 'What is the capital of France?' },
        { role: 'assistant', content: 'Paris is the capital of France.' },
      ];
      const response = {
        message: { role: 'assistant' as const, content: 'Paris is the capital of France.' },
        metrics: { success: true },
      };

      const mockStructuredResponse: StructuredResponse = {
        data: {
          score: 0.8,
          reasoning: 'The response is relevant to the question',
        },
        rawResponse: JSON.stringify({
          score: 0.8,
          reasoning: 'The response is relevant to the question',
        }),
        metrics: {
          success: true,
          usage: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockProvider.invokeStructuredModel.mockResolvedValue(mockStructuredResponse);

      const result = await judge.evaluateMessages(messages, response);

      expect(result).toEqual({
        score: 0.8,
        reasoning: 'The response is relevant to the question',
        metricKey: 'relevance',
        success: true,
        sampled: true,
        judgeConfigKey: 'test-judge',
      });

      expect(mockProvider.invokeStructuredModel).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: 'You are a helpful judge that evaluates AI responses.',
          }),
          expect.objectContaining({
            role: 'user',
            content:
              'Evaluate and report scores for important metrics: Input: What is the capital of France?\r\nParis is the capital of France., Output: Paris is the capital of France.',
          }),
        ]),
        expect.any(Object), // evaluation response structure
      );
    });

    it('handles sampling rate correctly', async () => {
      const messages: LDMessage[] = [{ role: 'user', content: 'test' }];
      const response = {
        message: { role: 'assistant' as const, content: 'test response' },
        metrics: { success: true },
      };

      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.8);

      const result = await judge.evaluateMessages(messages, response, 0.5);

      expect(result).toEqual({
        success: false,
        sampled: false,
        judgeConfigKey: 'test-judge',
      });
      expect(mockProvider.invokeStructuredModel).not.toHaveBeenCalled();

      Math.random = originalRandom;
    });
  });

  describe('_constructEvaluationMessages', () => {
    let judge: Judge;

    beforeEach(() => {
      judge = new Judge(judgeConfig, mockProvider, 1.0, mockLogger);
    });

    it('constructs evaluation messages correctly', () => {
      // eslint-disable-next-line no-underscore-dangle
      const constructMessages = (judge as any)._constructEvaluationMessages.bind(judge);
      const messages = constructMessages('test input', 'test output');

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful judge that evaluates AI responses.',
      });
      expect(messages[1]).toEqual({
        role: 'user',
        content:
          'Evaluate and report scores for important metrics: Input: test input, Output: test output',
      });
    });
  });

  describe('_parseEvaluationResponse', () => {
    let judge: Judge;

    beforeEach(() => {
      judge = new Judge(judgeConfig, mockProvider, 1.0, mockLogger);
    });

    it('parses valid evaluation response correctly', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = { score: 0.8, reasoning: 'Good' };

      const result = parseResponse(responseData);

      expect(result).toEqual({
        score: 0.8,
        reasoning: 'Good',
      });
    });

    it('returns undefined for empty response data', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);

      const result = parseResponse({});

      expect(result).toBeUndefined();
    });

    it('handles missing reasoning field', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = { score: 0.8 };

      const result = parseResponse(responseData);

      expect(result).toBeUndefined();
    });

    it('handles invalid score values out of range', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = { score: 1.5, reasoning: 'Good' };

      const result = parseResponse(responseData);

      expect(result).toBeUndefined();
    });

    it('handles negative score values', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = { score: -0.1, reasoning: 'Good' };

      const result = parseResponse(responseData);

      expect(result).toBeUndefined();
    });

    it('handles invalid reasoning type', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = { score: 0.8, reasoning: 123 };

      const result = parseResponse(responseData);

      expect(result).toBeUndefined();
    });

    it('handles empty evaluationMetricKeys array fallback', async () => {
      const configWithEmptyKeys: LDAIJudgeConfig = {
        ...judgeConfig,
        evaluationMetricKey: undefined,
        evaluationMetricKeys: [],
      };
      const judgeWithEmptyKeys = new Judge(configWithEmptyKeys, mockProvider, 1.0, mockLogger);

      const result = await judgeWithEmptyKeys.evaluate('test input', 'test output');

      expect(result).toEqual({
        success: false,
        sampled: true,
        errorMessage: 'Judge configuration is missing required evaluation metric key',
        judgeConfigKey: 'test-judge',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Judge configuration is missing required evaluation metric key',
        mockTrackData,
      );
    });
  });
});
