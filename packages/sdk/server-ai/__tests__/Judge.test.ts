import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfigTracker } from '../src/api/config/LDAIConfigTracker';
import { LDAIJudgeConfig, LDMessage } from '../src/api/config/types';
import { Judge } from '../src/api/judge/Judge';
import { RunnerResult } from '../src/api/model/types';
import { Runner } from '../src/api/providers/Runner';

describe('Judge', () => {
  let mockRunner: jest.Mocked<Runner>;
  let mockTracker: jest.Mocked<LDAIConfigTracker>;
  let mockLogger: jest.Mocked<LDLogger>;
  let judgeConfig: LDAIJudgeConfig;

  const mockTrackData = {
    variationKey: 'test-variation',
    configKey: 'test-config',
    version: 1,
  };

  beforeEach(() => {
    mockRunner = {
      run: jest.fn(),
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
      messages: [{ role: 'system', content: 'You are a helpful judge that evaluates AI responses.' }],
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      createTracker: () => mockTracker,
      evaluationMetricKey: 'relevance',
    };
  });

  describe('constructor', () => {
    it('initializes with proper configuration', () => {
      const judge = new Judge(judgeConfig, mockRunner, 1.0, mockLogger);

      expect(judge).toBeDefined();
    });

    it('defaults sampleRate to 1.0 when omitted', () => {
      const judge = new Judge(judgeConfig, mockRunner);
      expect(judge.sampleRate).toBe(1.0);
    });

    it('exposes the sampleRate provided to the constructor', () => {
      const judge = new Judge(judgeConfig, mockRunner, 0.25, mockLogger);
      expect(judge.sampleRate).toBe(0.25);
    });

    it('honors a sampleRate of 0', () => {
      const judge = new Judge(judgeConfig, mockRunner, 0, mockLogger);
      expect(judge.sampleRate).toBe(0);
    });
  });

  describe('sampling fallback in evaluate()', () => {
    it('uses the constructor sampleRate when no per-call rate is supplied', async () => {
      // Force sampling to skip: math.random() returns 0.6, sampleRate 0.5 → 0.6 > 0.5 → skip.
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.6);

      const judge = new Judge(judgeConfig, mockRunner, 0.5, mockLogger);
      const result = await judge.evaluate('input', 'output');

      // Skipped due to sampling: sampled stays false (default), no runner call.
      expect(result.sampled).toBe(false);
      expect(mockRunner.run).not.toHaveBeenCalled();

      randomSpy.mockRestore();
    });

    it('honors an explicit per-call samplingRate of 0 over the constructor default', async () => {
      // Even with Math.random() at 0, samplingRate=0 means 0 > 0 is false — skip path is
      // `Math.random() > rate`, so rate=0 + random=0 does NOT skip. Use random=0.5.
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Constructor rate is 1.0 (would normally always sample); per-call 0 overrides to skip.
      const judge = new Judge(judgeConfig, mockRunner, 1.0, mockLogger);
      const result = await judge.evaluate('input', 'output', 0);

      expect(result.sampled).toBe(false);
      expect(mockRunner.run).not.toHaveBeenCalled();

      randomSpy.mockRestore();
    });

    it('per-call samplingRate of undefined falls through to the constructor default', async () => {
      // Constructor 0 (always skip), per-call undefined → effective rate 0.
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const judge = new Judge(judgeConfig, mockRunner, 0, mockLogger);
      const result = await judge.evaluate('input', 'output', undefined);

      expect(result.sampled).toBe(false);
      expect(mockRunner.run).not.toHaveBeenCalled();

      randomSpy.mockRestore();
    });
  });

  describe('evaluate', () => {
    let judge: Judge;

    beforeEach(() => {
      judge = new Judge(judgeConfig, mockRunner, 1.0, mockLogger);
    });

    it('evaluates AI response successfully', async () => {
      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: {
          score: 0.8,
          reasoning: 'The response is relevant to the question',
        },
        metrics: {
          success: true,
          tokens: {
            total: 100,
            input: 50,
            output: 50,
          },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

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

      expect(mockRunner.run).toHaveBeenCalledWith(
        'MESSAGE HISTORY:\nWhat is the capital of France?\n\nRESPONSE TO EVALUATE:\nParis is the capital of France.',
        expect.any(Object), // evaluation schema
      );
    });

    it('passes a string input to the runner (not a message list)', async () => {
      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: {
          score: 0.85,
          reasoning: 'Good answer.',
        },
        metrics: { success: true },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

      await judge.evaluate('What is AI?', 'AI is artificial intelligence.');

      expect(mockRunner.run).toHaveBeenCalledTimes(1);
      const inputArg = mockRunner.run.mock.calls[0][0];
      expect(typeof inputArg).toBe('string');
      expect(inputArg).toContain('MESSAGE HISTORY:\nWhat is AI?');
      expect(inputArg).toContain('RESPONSE TO EVALUATE:\nAI is artificial intelligence.');
    });

    it('returns evaluation result with correct evaluationMetricKey for tracker integration', async () => {
      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: {
          score: 0.85,
          reasoning: 'Highly relevant response',
        },
        metrics: {
          success: true,
          tokens: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

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

      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: {
          score: 0.8,
          reasoning: 'Good',
        },
        metrics: {
          success: true,
          tokens: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

      const result = await judge.evaluate('test input', 'test output', 0.5);

      expect(result).toBeDefined();
      expect(result.sampled).toBe(true);
      expect(mockRunner.run).toHaveBeenCalled();

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
      expect(mockRunner.run).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Judge evaluation skipped due to sampling rate: 0.5',
      );

      Math.random = originalRandom;
    });

    it('returns error result when evaluationMetricKey is missing', async () => {
      const configWithoutMetrics: LDAIJudgeConfig = {
        ...judgeConfig,
        evaluationMetricKey: undefined,
      };
      const judgeWithoutMetrics = new Judge(configWithoutMetrics, mockRunner, 1.0, mockLogger);

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
      };
      const judgeWithSingleKey = new Judge(configWithSingleKey, mockRunner, 1.0, mockLogger);

      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: {
          score: 0.8,
          reasoning: 'The response is relevant',
        },
        metrics: {
          success: true,
          tokens: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

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

    it('proceeds (does not error early) when messages is undefined', async () => {
      const configWithoutMessages: LDAIJudgeConfig = {
        ...judgeConfig,
        messages: undefined,
      };
      const judgeWithoutMessages = new Judge(configWithoutMessages, mockRunner, 1.0, mockLogger);

      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: {
          score: 0.7,
          reasoning: 'Acceptable response.',
        },
        metrics: { success: true },
      };
      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

      const result = await judgeWithoutMessages.evaluate('test input', 'test output');

      expect(result.sampled).toBe(true);
      expect(result.success).toBe(true);
      expect(mockRunner.run).toHaveBeenCalledTimes(1);
    });

    it('returns result with success false when parsed is undefined or has no score/reasoning', async () => {
      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: undefined,
        metrics: {
          success: true,
          tokens: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

      const result = await judge.evaluate('test input', 'test output');

      expect(result).toEqual({
        success: false,
        sampled: true,
        judgeConfigKey: 'test-judge',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Could not parse evaluation response: undefined',
        mockTrackData,
      );
    });

    it('returns result with success false when parsed is an empty object', async () => {
      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: {},
        metrics: {
          success: true,
          tokens: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

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
      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: {
          evaluations: {
            relevance: { score: 0.8, reasoning: 'Good' },
          },
        },
        metrics: {
          success: true,
          tokens: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

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

    it('handles runner errors gracefully', async () => {
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
      judge = new Judge(judgeConfig, mockRunner, 1.0, mockLogger);
    });

    it('evaluates messages and response successfully', async () => {
      const messages: LDMessage[] = [
        { role: 'user', content: 'What is the capital of France?' },
        { role: 'assistant', content: 'Paris is the capital of France.' },
      ];
      const response: RunnerResult = {
        content: 'Paris is the capital of France.',
        metrics: { success: true },
      };

      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: {
          score: 0.8,
          reasoning: 'The response is relevant to the question',
        },
        metrics: {
          success: true,
          tokens: { total: 100, input: 50, output: 50 },
        },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

      const result = await judge.evaluateMessages(messages, response);

      expect(result).toEqual({
        score: 0.8,
        reasoning: 'The response is relevant to the question',
        metricKey: 'relevance',
        success: true,
        sampled: true,
        judgeConfigKey: 'test-judge',
      });

      expect(mockRunner.run).toHaveBeenCalledWith(
        'MESSAGE HISTORY:\nuser: What is the capital of France?\nassistant: Paris is the capital of France.\n\nRESPONSE TO EVALUATE:\nParis is the capital of France.',
        expect.any(Object), // evaluation schema
      );
    });

    it('renders each message as "<role>: <content>" joined by newlines', async () => {
      const messages: LDMessage[] = [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ];
      const response: RunnerResult = {
        content: 'hello',
        metrics: { success: true },
      };

      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: { score: 0.5, reasoning: 'ok' },
        metrics: { success: true },
      };
      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

      await judge.evaluateMessages(messages, response);

      const inputArg = mockRunner.run.mock.calls[0][0] as string;
      expect(inputArg).toContain('MESSAGE HISTORY:\nuser: hi\nassistant: hello');
    });

    it('produces an empty MESSAGE HISTORY section when messages is empty', async () => {
      const response: RunnerResult = {
        content: 'output',
        metrics: { success: true },
      };

      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: { score: 0.5, reasoning: 'ok' },
        metrics: { success: true },
      };
      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

      await judge.evaluateMessages([], response);

      const inputArg = mockRunner.run.mock.calls[0][0] as string;
      expect(inputArg).toBe('MESSAGE HISTORY:\n\n\nRESPONSE TO EVALUATE:\noutput');
    });

    it('does not contaminate the runner input across successive evaluations', async () => {
      const mockRunnerResult: RunnerResult = {
        content: '',
        parsed: { score: 0.5, reasoning: 'ok' },
        metrics: { success: true },
      };
      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());
      mockRunner.run.mockResolvedValue(mockRunnerResult);

      await judge.evaluate('Q1', 'A1');
      await judge.evaluate('Q2', 'A2');

      const firstInput = mockRunner.run.mock.calls[0][0] as string;
      const secondInput = mockRunner.run.mock.calls[1][0] as string;

      expect(firstInput).toBe(
        'MESSAGE HISTORY:\nQ1\n\nRESPONSE TO EVALUATE:\nA1',
      );
      expect(secondInput).toBe(
        'MESSAGE HISTORY:\nQ2\n\nRESPONSE TO EVALUATE:\nA2',
      );
      // The second call's input must not reference the first call.
      expect(secondInput).not.toContain('Q1');
      expect(secondInput).not.toContain('A1');
    });

    it('handles sampling rate correctly', async () => {
      const messages: LDMessage[] = [{ role: 'user', content: 'test' }];
      const response: RunnerResult = {
        content: 'test response',
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
      expect(mockRunner.run).not.toHaveBeenCalled();

      Math.random = originalRandom;
    });
  });

  describe('_buildEvaluationInput', () => {
    let judge: Judge;

    beforeEach(() => {
      judge = new Judge(judgeConfig, mockRunner, 1.0, mockLogger);
    });

    it('builds the evaluation string in the expected format', () => {
      // eslint-disable-next-line no-underscore-dangle
      const buildInput = (judge as any)._buildEvaluationInput.bind(judge);
      const input = buildInput('hello', 'world');

      expect(input).toBe('MESSAGE HISTORY:\nhello\n\nRESPONSE TO EVALUATE:\nworld');
    });
  });

  describe('_parseEvaluationResponse', () => {
    let judge: Judge;

    beforeEach(() => {
      judge = new Judge(judgeConfig, mockRunner, 1.0, mockLogger);
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

  });
});
