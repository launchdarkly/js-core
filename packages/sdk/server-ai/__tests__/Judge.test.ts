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
    // Mock the AIProvider - only mock what's actually used
    mockProvider = {
      invokeStructuredModel: jest.fn(),
    } as any;

    // Mock the LDAIConfigTracker - only mock what's actually used
    mockTracker = {
      trackMetricsOf: jest.fn(),
      getTrackData: jest.fn().mockReturnValue(mockTrackData),
    } as any;

    // Mock the logger - only mock what's actually used
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Create a basic judge config
    judgeConfig = {
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
      evaluationMetricKeys: ['relevance', 'accuracy', 'helpfulness'],
      toVercelAISDK: jest.fn(),
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
            accuracy: { score: 0.9, reasoning: 'The response is factually accurate' },
            helpfulness: { score: 0.7, reasoning: 'The response provides helpful information' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            relevance: { score: 0.8, reasoning: 'The response is relevant to the question' },
            accuracy: { score: 0.9, reasoning: 'The response is factually accurate' },
            helpfulness: { score: 0.7, reasoning: 'The response provides helpful information' },
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
          relevance: { score: 0.8, reasoning: 'The response is relevant to the question' },
          accuracy: { score: 0.9, reasoning: 'The response is factually accurate' },
          helpfulness: { score: 0.7, reasoning: 'The response provides helpful information' },
        },
        success: true,
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

    it('handles sampling rate correctly', async () => {
      // Mock Math.random to return 0.3 (should be sampled with rate 0.5 since 0.3 <= 0.5)
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.3);

      // Mock the structured response
      const mockStructuredResponse: StructuredResponse = {
        data: {
          evaluations: {
            relevance: { score: 0.8, reasoning: 'Good' },
            accuracy: { score: 0.9, reasoning: 'Accurate' },
            helpfulness: { score: 0.7, reasoning: 'Helpful' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            relevance: { score: 0.8, reasoning: 'Good' },
            accuracy: { score: 0.9, reasoning: 'Accurate' },
            helpfulness: { score: 0.7, reasoning: 'Helpful' },
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
      // Mock Math.random to return 0.8 (should not be sampled with rate 0.5 since 0.8 > 0.5)
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

    it('returns undefined when evaluationMetricKeys is empty', async () => {
      const configWithoutMetrics: LDAIJudgeConfig = {
        ...judgeConfig,
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
        'Judge configuration is missing required evaluationMetricKeys',
        mockTrackData,
      );
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

    it('returns partial evaluations when some metrics are missing', async () => {
      const mockStructuredResponse: StructuredResponse = {
        data: {
          evaluations: {
            relevance: { score: 0.8, reasoning: 'Good' },
            // accuracy is missing
            helpfulness: { score: 0.7, reasoning: 'Helpful' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            relevance: { score: 0.8, reasoning: 'Good' },
            helpfulness: { score: 0.7, reasoning: 'Helpful' },
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

      // When one metric is missing, it returns the partial evals it has with success: false
      expect(result).toEqual({
        evals: {
          relevance: { score: 0.8, reasoning: 'Good' },
          helpfulness: { score: 0.7, reasoning: 'Helpful' },
        },
        success: false,
      });
    });

    it('returns empty evaluations when response structure is malformed', async () => {
      const mockStructuredResponse: StructuredResponse = {
        data: {
          // Missing 'evaluations' wrapper - malformed structure
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

      // When the structure is completely wrong, returns empty evals with success: false
      expect(result).toEqual({
        evals: {},
        success: false,
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
            accuracy: { score: 0.9, reasoning: 'The response is factually accurate' },
            helpfulness: { score: 0.7, reasoning: 'The response provides helpful information' },
          },
        },
        rawResponse: JSON.stringify({
          evaluations: {
            relevance: { score: 0.8, reasoning: 'The response is relevant to the question' },
            accuracy: { score: 0.9, reasoning: 'The response is factually accurate' },
            helpfulness: { score: 0.7, reasoning: 'The response provides helpful information' },
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
          relevance: { score: 0.8, reasoning: 'The response is relevant to the question' },
          accuracy: { score: 0.9, reasoning: 'The response is factually accurate' },
          helpfulness: { score: 0.7, reasoning: 'The response provides helpful information' },
        },
        success: true,
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

      // Mock Math.random to return 0.8 (should not be sampled with rate 0.5 since 0.8 > 0.5)
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
      // Access private method for testing
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
          accuracy: { score: 0.9, reasoning: 'Accurate' },
          helpfulness: { score: 0.7, reasoning: 'Helpful' },
        },
      };

      const result = parseResponse(responseData);

      expect(result).toEqual({
        relevance: { score: 0.8, reasoning: 'Good' },
        accuracy: { score: 0.9, reasoning: 'Accurate' },
        helpfulness: { score: 0.7, reasoning: 'Helpful' },
      });
    });

    it('returns empty object for invalid response data', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = {
        relevance: { score: 0.8, reasoning: 'Good' },
        // Missing evaluations wrapper - invalid structure
      };

      const result = parseResponse(responseData);

      // Returns empty object when evaluations structure is missing
      expect(result).toEqual({});
    });

    it('handles missing score or reasoning fields', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parseResponse = (judge as any)._parseEvaluationResponse.bind(judge);
      const responseData = {
        evaluations: {
          relevance: { score: 0.8 }, // Missing reasoning
          accuracy: { reasoning: 'Accurate' }, // Missing score
          helpfulness: { score: 0.7, reasoning: 'Helpful' },
        },
      };

      const result = parseResponse(responseData);

      // Only helpfulness passes validation, relevance and accuracy are skipped
      expect(result).toEqual({
        helpfulness: { score: 0.7, reasoning: 'Helpful' },
      });
    });
  });
});
