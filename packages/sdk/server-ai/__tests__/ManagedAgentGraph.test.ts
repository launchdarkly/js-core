import { AgentGraphDefinition } from '../src/api/graph/AgentGraphDefinition';
import { LDGraphTracker } from '../src/api/graph/LDGraphTracker';
import { ManagedAgentGraph } from '../src/api/graph/ManagedAgentGraph';
import { AgentGraphRunnerResult } from '../src/api/graph/types';

describe('ManagedAgentGraph', () => {
  const mockTracker: jest.Mocked<LDGraphTracker> = {
    getTrackData: jest.fn().mockReturnValue({ runId: 'r1', graphKey: 'g1', version: 1 }),
    getSummary: jest.fn().mockReturnValue({}),
    resumptionToken: 'graph-resumption-token',
    trackInvocationSuccess: jest.fn(),
    trackInvocationFailure: jest.fn(),
    trackDuration: jest.fn(),
    trackTotalTokens: jest.fn(),
    trackPath: jest.fn(),
    trackRedirect: jest.fn(),
    trackHandoffSuccess: jest.fn(),
    trackHandoffFailure: jest.fn(),
  };

  let mockGraphDefinition: jest.Mocked<AgentGraphDefinition>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGraphDefinition = {
      enabled: true,
      createTracker: jest.fn().mockReturnValue(mockTracker),
      getConfig: jest.fn(),
      getNode: jest.fn(),
      getChildNodes: jest.fn(),
      getParentNodes: jest.fn(),
      terminalNodes: jest.fn(),
      rootNode: jest.fn(),
      traverse: jest.fn(),
      reverseTraverse: jest.fn(),
    } as any;
  });

  it('run() builds ManagedGraphResult from runner result', async () => {
    const runnerResult: AgentGraphRunnerResult = {
      content: 'Graph output',
      metrics: {
        success: true,
        path: ['node-a', 'node-b'],
        durationMs: 1500,
        usage: { total: 100, input: 50, output: 50 },
        nodeMetrics: {
          'node-a': { success: true },
          'node-b': { success: true },
        },
      },
    };

    const managedGraph = new ManagedAgentGraph(mockGraphDefinition);
    const result = await managedGraph.run(async (_def, _tracker) => runnerResult);

    expect(result.content).toBe('Graph output');
    expect(result.metrics.success).toBe(true);
    expect(result.metrics.path).toEqual(['node-a', 'node-b']);
    expect(result.metrics.durationMs).toBe(1500);
    expect(result.metrics.resumptionToken).toBe('graph-resumption-token');
    expect(result.metrics.nodeMetrics).toEqual({
      'node-a': { success: true },
      'node-b': { success: true },
    });
  });

  it('run() passes graphDefinition and graphTracker to runner', async () => {
    const runnerFn = jest.fn().mockResolvedValue({
      content: 'output',
      metrics: {
        success: true,
        path: [],
        nodeMetrics: {},
      },
    });

    const managedGraph = new ManagedAgentGraph(mockGraphDefinition);
    await managedGraph.run(runnerFn);

    expect(runnerFn).toHaveBeenCalledWith(mockGraphDefinition, mockTracker);
  });

  it('run() creates a tracker via graphDefinition.createTracker()', async () => {
    const managedGraph = new ManagedAgentGraph(mockGraphDefinition);
    await managedGraph.run(async () => ({
      content: '',
      metrics: { success: true, path: [], nodeMetrics: {} },
    }));

    expect(mockGraphDefinition.createTracker).toHaveBeenCalled();
  });

  it('resolves to empty evaluations by default', async () => {
    const managedGraph = new ManagedAgentGraph(mockGraphDefinition);
    const result = await managedGraph.run(async () => ({
      content: '',
      metrics: { success: true, path: [], nodeMetrics: {} },
    }));

    const evaluations = await result.evaluations;
    expect(evaluations).toEqual([]);
  });

  it('getGraphDefinition() returns the graph definition', () => {
    const managedGraph = new ManagedAgentGraph(mockGraphDefinition);
    expect(managedGraph.getGraphDefinition()).toBe(mockGraphDefinition);
  });
});
