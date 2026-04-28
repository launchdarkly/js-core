import type { AgentGraphRunnerResult } from '../src/api/graph/types';
import type { RunnerResult } from '../src/api/model/types';
import type { AgentGraphRunner, Runner } from '../src/api/providers/Runner';

/**
 * Verify that the Runner and AgentGraphRunner protocols can be implemented
 * by a plain object (no abstract class required).
 */
describe('Runner protocol', () => {
  it('can be implemented as a plain object (no class extension required)', async () => {
    const runnerResult: RunnerResult = {
      content: 'Hello from runner',
      metrics: { success: true },
    };

    const myRunner: Runner = {
      run: jest.fn().mockResolvedValue(runnerResult),
    };

    const result = await myRunner.run([{ role: 'user', content: 'Hello' }]);

    expect(result.content).toBe('Hello from runner');
    expect(result.metrics.success).toBe(true);
  });

  it('Runner.run() accepts optional outputType for structured output', async () => {
    const runnerResult: RunnerResult = {
      content: '',
      metrics: { success: true },
      parsed: { score: 0.9, reasoning: 'good' },
    };

    const myRunner: Runner = {
      run: jest.fn().mockResolvedValue(runnerResult),
    };

    const schema = { type: 'object', properties: { score: { type: 'number' } } };
    const result = await myRunner.run([{ role: 'user', content: 'Evaluate' }], schema);

    expect(result.parsed).toEqual({ score: 0.9, reasoning: 'good' });
    expect(myRunner.run).toHaveBeenCalledWith([{ role: 'user', content: 'Evaluate' }], schema);
  });

  it('AgentGraphRunner can be implemented as a plain object', async () => {
    const graphResult: AgentGraphRunnerResult = {
      content: 'Graph output',
      metrics: {
        success: true,
        path: ['node-a'],
        nodeMetrics: { 'node-a': { success: true } },
      },
    };

    const myGraphRunner: AgentGraphRunner = {
      run: jest.fn().mockResolvedValue(graphResult),
    };

    const result = await myGraphRunner.run('user input');

    expect(result.content).toBe('Graph output');
    expect(result.metrics.path).toEqual(['node-a']);
  });

  it('RunnerResult does NOT include evaluations field', () => {
    const result: RunnerResult = {
      content: 'test',
      metrics: { success: true },
    };

    // TypeScript would catch this at compile time, but verify at runtime shape too
    expect('evaluations' in result).toBe(false);
  });
});
