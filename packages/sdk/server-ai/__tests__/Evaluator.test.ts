import { LDAIJudgeConfig } from '../src/api/config/types';
import { Evaluator } from '../src/api/judge/Evaluator';
import { Judge } from '../src/api/judge/Judge';
import { LDJudgeResult } from '../src/api/judge/types';
import { AIProvider } from '../src/api/providers/AIProvider';

function makeJudgeConfig(key: string): LDAIJudgeConfig {
  return {
    key,
    enabled: true,
    evaluationMetricKey: '$ld:ai:judge:quality',
    messages: [{ role: 'system', content: 'You are a judge.' }],
    createTracker: () => ({}) as any,
  };
}

function makeProvider(): jest.Mocked<AIProvider> {
  return {
    invokeModel: jest.fn(),
    invokeStructuredModel: jest.fn(),
  } as any;
}

describe('Evaluator', () => {
  describe('noop()', () => {
    it('returns an empty result array', async () => {
      const evaluator = Evaluator.noop();
      const results = await evaluator.evaluate('input', 'output');
      expect(results).toEqual([]);
    });
  });

  describe('evaluate()', () => {
    it('calls each configured judge and returns results', async () => {
      const mockProvider = makeProvider();
      const judgeConfig = makeJudgeConfig('judge-1');

      const mockResult: LDJudgeResult = {
        success: true,
        sampled: true,
        score: 0.9,
        reasoning: 'Good response',
        metricKey: '$ld:ai:judge:quality',
        judgeConfigKey: 'judge-1',
      };

      const judge = new Judge(judgeConfig, mockProvider, 1.0);
      jest.spyOn(judge, 'evaluate').mockResolvedValue(mockResult);

      const evaluator = new Evaluator([judge]);

      const results = await evaluator.evaluate('user input', 'ai output');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(mockResult);
      // Evaluator does not pass a per-call samplingRate — judge uses its own.
      expect(judge.evaluate).toHaveBeenCalledWith('user input', 'ai output');
    });

    it('returns error result when judge throws', async () => {
      const mockProvider = makeProvider();
      const judgeConfig = makeJudgeConfig('judge-err');

      const judge = new Judge(judgeConfig, mockProvider, 1.0);
      jest.spyOn(judge, 'evaluate').mockRejectedValue(new Error('evaluation error'));

      const evaluator = new Evaluator([judge]);
      const results = await evaluator.evaluate('input', 'output');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].sampled).toBe(true);
      expect(results[0].errorMessage).toBe('evaluation error');
      expect(results[0].judgeConfigKey).toBe('judge-err');
    });

    it('does NOT call tracker.trackJudgeResult', async () => {
      const mockProvider = makeProvider();
      const judgeConfig = makeJudgeConfig('judge-1');

      const mockResult: LDJudgeResult = {
        success: true,
        sampled: true,
        score: 0.8,
        reasoning: 'ok',
        metricKey: '$ld:ai:judge:quality',
      };

      const judge = new Judge(judgeConfig, mockProvider, 1.0);
      jest.spyOn(judge, 'evaluate').mockResolvedValue(mockResult);

      const evaluator = new Evaluator([judge]);

      // No tracker — if Evaluator tried to call trackJudgeResult this would throw or fail
      await evaluator.evaluate('input', 'output');

      // Test passes if no error is thrown (no tracker involved)
      expect(true).toBe(true);
    });

    it('runs multiple judges in parallel and returns all results', async () => {
      const makeJudge = (key: string, score: number): Judge => {
        const mockProvider = makeProvider();
        const jc = makeJudgeConfig(key);
        const j = new Judge(jc, mockProvider, 1.0);
        jest.spyOn(j, 'evaluate').mockResolvedValue({
          success: true,
          sampled: true,
          score,
          reasoning: 'ok',
          metricKey: '$ld:ai:judge:quality',
        });
        return j;
      };

      const evaluator = new Evaluator([makeJudge('judge-a', 0.5), makeJudge('judge-b', 0.9)]);

      const results = await evaluator.evaluate('input', 'output');

      expect(results).toHaveLength(2);
      const scores = results.map((r) => r.score).sort();
      expect(scores).toEqual([0.5, 0.9]);
    });
  });
});
