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
      tracker: mockTracker,
      evaluationMetricKey: 'relevance',
    };
  });

  describe('constructor', () => {
    it('initializes with proper configuration', () => {
      const judge = new Judge(judgeConfig, mockTracker, mockProvider, mockLogger);

      expect(judge).toBeDefined();
    });
  });

  describe('evaluate', () => {
    let judge: Judge;

    beforeEach(() => {
      judge = new Judge(judgeConfig, mockTracker, mockProvider, mockLogger);
    });

    it('evaluates AI response successfully', async () => {
      const mockStructuredResponse: StructuredResponse = {
        data: {
          evaluations: {
            relevance: { score: 0.8, reasoning: 'The response is relevant to the question' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            relevance: { score: 0.8, reasoning: 'The response is relevant to the question' },
          },
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
        evals: {
          relevance: {
            score: 0.8,
            reasoning: 'The response is relevant to the question',
          },
        },
        success: true,
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
          evaluations: {
            relevance: { score: 0.85, reasoning: 'Highly relevant response' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            relevance: { score: 0.85, reasoning: 'Highly relevant response' },
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

      expect(result).toBeDefined();
      expect(result?.evals).toHaveProperty('relevance');
      expect(result?.evals.relevance.score).toBe(0.85);
      expect(result?.judgeConfigKey).toBe('test-judge');
      expect(result?.success).toBe(true);
      // Verify the evaluationMetricKey from config is used in the result
      expect(Object.keys(result?.evals || {})).toContain(judgeConfig.evaluationMetricKey);
    });

    it('handles sampling rate correctly', async () => {
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.3);

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

      const result = await judge.evaluate('test input', 'test output', 0.5);

      expect(result).toBeDefined();
      expect(mockProvider.invokeStructuredModel).toHaveBeenCalled();

      Math.random = originalRandom;
    });

    it('returns undefined when not sampled', async () => {
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.8);

      const result = await judge.evaluate('test input', 'test output', 0.5);

      expect(result).toBeUndefined();
      expect(mockProvider.invokeStructuredModel).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Judge evaluation skipped due to sampling rate: 0.5',
      );

      Math.random = originalRandom;
    });

    it('returns undefined when evaluationMetricKey and evaluationMetricKeys are both missing', async () => {
      const configWithoutMetrics: LDAIJudgeConfig = {
        ...judgeConfig,
        evaluationMetricKey: undefined,
        evaluationMetricKeys: [],
      };
      const judgeWithoutMetrics = new Judge(
        configWithoutMetrics,
        mockTracker,
        mockProvider,
        mockLogger,
      );

      const result = await judgeWithoutMetrics.evaluate('test input', 'test output');

      expect(result).toBeUndefined();
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
      const judgeWithSingleKey = new Judge(
        configWithSingleKey,
        mockTracker,
        mockProvider,
        mockLogger,
      );

      const mockStructuredResponse: StructuredResponse = {
        data: {
          evaluations: {
            relevance: { score: 0.8, reasoning: 'The response is relevant' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            relevance: { score: 0.8, reasoning: 'The response is relevant' },
          },
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
        evals: {
          relevance: { score: 0.8, reasoning: 'The response is relevant' },
        },
        success: true,
        judgeConfigKey: 'test-judge',
      });
    });

    it('falls back to first value in evaluationMetricKeys when evaluationMetricKey is not provided', async () => {
      const configWithLegacyKeys: LDAIJudgeConfig = {
        ...judgeConfig,
        evaluationMetricKey: undefined,
        evaluationMetricKeys: ['relevance', 'accuracy'],
      };
      const judgeWithLegacyKeys = new Judge(
        configWithLegacyKeys,
        mockTracker,
        mockProvider,
        mockLogger,
      );

      const mockStructuredResponse: StructuredResponse = {
        data: {
          evaluations: {
            relevance: { score: 0.8, reasoning: 'The response is relevant' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            relevance: { score: 0.8, reasoning: 'The response is relevant' },
          },
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
        evals: {
          relevance: { score: 0.8, reasoning: 'The response is relevant' },
        },
        success: true,
        judgeConfigKey: 'test-judge',
      });
    });

    it('skips empty and whitespace-only strings in evaluationMetricKeys array', async () => {
      const configWithInvalidKeys: LDAIJudgeConfig = {
        ...judgeConfig,
        evaluationMetricKey: undefined,
        evaluationMetricKeys: ['', '   ', 'relevance', 'accuracy'],
      };
      const judgeWithInvalidKeys = new Judge(
        configWithInvalidKeys,
        mockTracker,
        mockProvider,
        mockLogger,
      );

      const mockStructuredResponse: StructuredResponse = {
        data: {
          evaluations: {
            relevance: { score: 0.8, reasoning: 'The response is relevant' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            relevance: { score: 0.8, reasoning: 'The response is relevant' },
          },
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
        evals: {
          relevance: { score: 0.8, reasoning: 'The response is relevant' },
        },
        success: true,
        judgeConfigKey: 'test-judge',
      });
    });

    it('prioritizes evaluationMetricKey over evaluationMetricKeys when both are provided', async () => {
      const configWithBoth: LDAIJudgeConfig = {
        ...judgeConfig,
        evaluationMetricKey: 'helpfulness',
        evaluationMetricKeys: ['relevance', 'accuracy'],
      };
      const judgeWithBoth = new Judge(configWithBoth, mockTracker, mockProvider, mockLogger);

      const mockStructuredResponse: StructuredResponse = {
        data: {
          evaluations: {
            helpfulness: { score: 0.7, reasoning: 'The response is helpful' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            helpfulness: { score: 0.7, reasoning: 'The response is helpful' },
          },
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
        evals: {
          helpfulness: { score: 0.7, reasoning: 'The response is helpful' },
        },
        success: true,
        judgeConfigKey: 'test-judge',
      });
    });

    it('returns undefined when messages are missing', async () => {
      const configWithoutMessages: LDAIJudgeConfig = {
        ...judgeConfig,
        messages: undefined,
      };
      const judgeWithoutMessages = new Judge(
        configWithoutMessages,
        mockTracker,
        mockProvider,
        mockLogger,
      );

      const result = await judgeWithoutMessages.evaluate('test input', 'test output');

      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Judge configuration must include messages',
        mockTrackData,
      );
    });

    it('returns empty evaluations with success false when expected metric is missing', async () => {
      const mockStructuredResponse: StructuredResponse = {
        data: {
          evaluations: {
            accuracy: { score: 0.9, reasoning: 'Accurate' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            accuracy: { score: 0.9, reasoning: 'Accurate' },
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
        evals: {},
        success: false,
        judgeConfigKey: 'test-judge',
      });
    });

    it('returns empty evaluations when response structure is malformed', async () => {
      const mockStructuredResponse: StructuredResponse = {
        data: {
          relevance: { score: 0.8, reasoning: 'Good' },
          accuracy: { score: 0.9, reasoning: 'Accurate' },
          helpfulness: { score: 0.7, reasoning: 'Helpful' },
        },
        rawResponse: JSON.stringify({
          relevance: { score: 0.8, reasoning: 'Good' },
          accuracy: { score: 0.9, reasoning: 'Accurate' },
          helpfulness: { score: 0.7, reasoning: 'Helpful' },
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
        evals: {},
        success: false,
        judgeConfigKey: 'test-judge',
      });
    });

    it('handles provider errors gracefully', async () => {
      const error = new Error('Provider error');
      mockTracker.trackMetricsOf.mockRejectedValue(error);

      const result = await judge.evaluate('test input', 'test output');

      expect(result).toEqual({
        evals: {},
        success: false,
        error: 'Provider error',
        judgeConfigKey: 'test-judge',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Judge evaluation failed:', error);
    });

    it('handles non-Error exceptions', async () => {
      mockTracker.trackMetricsOf.mockRejectedValue('String error');

      const result = await judge.evaluate('test input', 'test output');

      expect(result).toEqual({
        evals: {},
        success: false,
        error: 'Unknown error',
        judgeConfigKey: 'test-judge',
      });
    });
  });

  describe('evaluateMessages', () => {
    let judge: Judge;

    beforeEach(() => {
      judge = new Judge(judgeConfig, mockTracker, mockProvider, mockLogger);
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
          evaluations: {
            relevance: { score: 0.8, reasoning: 'The response is relevant to the question' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            relevance: { score: 0.8, reasoning: 'The response is relevant to the question' },
          },
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
        evals: {
          relevance: {
            score: 0.8,
            reasoning: 'The response is relevant to the question',
          },
        },
        success: true,
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

      expect(result).toBeUndefined();
      expect(mockProvider.invokeStructuredModel).not.toHaveBeenCalled();

      Math.random = originalRandom;
    });
  });

  describe('_constructEvaluationMessages', () => {
    let judge: Judge;

    beforeEach(() => {
      judge = new Judge(judgeConfig, mockTracker, mockProvider, mockLogger);
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
      judge = new Judge(judgeConfig, mockTracker, mockProvider, mockLogger);
    });

    it('parses valid evaluation response correctly', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = {
        evaluations: {
          relevance: { score: 0.8, reasoning: 'Good' },
        },
      };

      const result = parseResponse(responseData, 'relevance');

      expect(result).toEqual({
        relevance: { score: 0.8, reasoning: 'Good' },
      });
    });

    it('returns empty object for invalid response data', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = {
        relevance: { score: 0.8, reasoning: 'Good' },
      };

      const result = parseResponse(responseData, 'relevance');

      expect(result).toEqual({});
    });

    it('handles missing score or reasoning fields', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = {
        evaluations: {
          relevance: { score: 0.8 },
        },
      };

      const result = parseResponse(responseData, 'relevance');

      expect(result).toEqual({});
    });

    it('handles invalid score values out of range', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = {
        evaluations: {
          relevance: { score: 1.5, reasoning: 'Good' },
        },
      };

      const result = parseResponse(responseData, 'relevance');

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid score evaluated for relevance: 1.5'),
        mockTrackData,
      );
    });

    it('handles negative score values', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = {
        evaluations: {
          relevance: { score: -0.1, reasoning: 'Good' },
        },
      };

      const result = parseResponse(responseData, 'relevance');

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid score evaluated for relevance: -0.1'),
        mockTrackData,
      );
    });

    it('handles invalid reasoning type', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = {
        evaluations: {
          relevance: { score: 0.8, reasoning: 123 },
        },
      };

      const result = parseResponse(responseData, 'relevance');

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid reasoning evaluated for relevance: 123'),
        mockTrackData,
      );
    });

    it('handles missing evaluation when key does not exist in response', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = {
        evaluations: {
          accuracy: { score: 0.9, reasoning: 'Accurate' },
        },
      };

      const result = parseResponse(responseData, 'relevance');

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Missing evaluation for metric key: relevance',
        mockTrackData,
      );
    });

    it('handles empty evaluationMetricKeys array fallback', async () => {
      const configWithEmptyKeys: LDAIJudgeConfig = {
        ...judgeConfig,
        evaluationMetricKey: undefined,
        evaluationMetricKeys: [],
      };
      const judgeWithEmptyKeys = new Judge(
        configWithEmptyKeys,
        mockTracker,
        mockProvider,
        mockLogger,
      );

      const result = await judgeWithEmptyKeys.evaluate('test input', 'test output');

      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Judge configuration is missing required evaluation metric key',
        mockTrackData,
      );
    });

    it('handles evaluation value that is not an object', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = {
        evaluations: {
          relevance: 'not an object',
        },
      };

      const result = parseResponse(responseData, 'relevance');

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Missing evaluation for metric key: relevance',
        mockTrackData,
      );
    });

    it('handles null evaluation value', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = {
        evaluations: {
          relevance: null,
        },
      };

      const result = parseResponse(responseData, 'relevance');

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Missing evaluation for metric key: relevance',
        mockTrackData,
      );
    });
  });
});
