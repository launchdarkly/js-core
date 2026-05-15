import { AgentGraphDefinition } from '../src/api/graph/AgentGraphDefinition';
import { AgentGraphNode } from '../src/api/graph/AgentGraphNode';
import { LDGraphTracker } from '../src/api/graph/LDGraphTracker';
import { ManagedAgentGraph } from '../src/api/ManagedAgentGraph';
import { AgentGraphRunnerResult } from '../src/api/graph/types';
import { LDAIConfigTracker } from '../src/api/config/LDAIConfigTracker';

const makeNodeTracker = (summary: Record<string, unknown> = {}): jest.Mocked<LDAIConfigTracker> =>
  ({
    trackTokens: jest.fn(),
    trackDuration: jest.fn(),
    trackToolCalls: jest.fn(),
    trackSuccess: jest.fn(),
    trackError: jest.fn(),
    getSummary: jest.fn().mockReturnValue(summary),
  }) as any;

const makeNode = (tracker: jest.Mocked<LDAIConfigTracker>): AgentGraphNode =>
  ({
    getConfig: jest.fn().mockReturnValue({ createTracker: jest.fn().mockReturnValue(tracker) }),
  }) as any;

describe('ManagedAgentGraph', () => {
  const mockGraphTracker: jest.Mocked<LDGraphTracker> = {
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
      createTracker: jest.fn().mockReturnValue(mockGraphTracker),
      getConfig: jest.fn(),
      getNode: jest.fn().mockReturnValue(undefined),
      getChildNodes: jest.fn(),
      getParentNodes: jest.fn(),
      terminalNodes: jest.fn(),
      rootNode: jest.fn(),
      traverse: jest.fn(),
      reverseTraverse: jest.fn(),
    } as any;
  });

  it('builds ManagedGraphResult from runner result', async () => {
    const nodeATracker = makeNodeTracker({ success: true, resumptionToken: 'node-a-token' });
    const nodeBTracker = makeNodeTracker({ success: true, resumptionToken: 'node-b-token' });
    mockGraphDefinition.getNode = jest
      .fn()
      .mockImplementation((key: string) =>
        key === 'node-a' ? makeNode(nodeATracker) : makeNode(nodeBTracker),
      );

    const runnerResult: AgentGraphRunnerResult = {
      content: 'Graph output',
      metrics: {
        success: true,
        path: ['node-a', 'node-b'],
        durationMs: 1500,
        tokens: { total: 100, input: 50, output: 50 },
        nodeMetrics: {
          'node-a': { success: true, tokens: { total: 40, input: 20, output: 20 } },
          'node-b': { success: true, tokens: { total: 60, input: 30, output: 30 } },
        },
      },
    };

    const managedGraph = new ManagedAgentGraph(mockGraphDefinition);
    const result = await managedGraph.run(async (_def, _tracker) => runnerResult);

    expect(result.content).toBe('Graph output');
    expect(result.metrics.success).toBe(true);
    expect(result.metrics.path).toEqual(['node-a', 'node-b']);
    expect(result.metrics.durationMs).toBe(1500);
    expect(result.metrics.tokens).toEqual({ total: 100, input: 50, output: 50 });
    expect(result.metrics.resumptionToken).toBe('graph-resumption-token');
    expect(result.metrics.nodeMetrics).toEqual({
      'node-a': { success: true, resumptionToken: 'node-a-token' },
      'node-b': { success: true, resumptionToken: 'node-b-token' },
    });
  });

  it('fires tracking events into per-node trackers', async () => {
    const nodeTracker = makeNodeTracker({});
    mockGraphDefinition.getNode = jest.fn().mockReturnValue(makeNode(nodeTracker));

    const runnerResult: AgentGraphRunnerResult = {
      content: 'out',
      metrics: {
        success: true,
        path: ['n1'],
        nodeMetrics: {
          n1: {
            success: true,
            tokens: { total: 10, input: 5, output: 5 },
            durationMs: 200,
            toolCalls: ['tool-a'],
          },
        },
      },
    };

    const managedGraph = new ManagedAgentGraph(mockGraphDefinition);
    await managedGraph.run(async () => runnerResult);

    expect(nodeTracker.trackTokens).toHaveBeenCalledWith({ total: 10, input: 5, output: 5 });
    expect(nodeTracker.trackDuration).toHaveBeenCalledWith(200);
    expect(nodeTracker.trackToolCalls).toHaveBeenCalledWith(['tool-a']);
    expect(nodeTracker.trackSuccess).toHaveBeenCalled();
    expect(nodeTracker.getSummary).toHaveBeenCalled();
  });

  it('calls trackError for failed nodes', async () => {
    const nodeTracker = makeNodeTracker({});
    mockGraphDefinition.getNode = jest.fn().mockReturnValue(makeNode(nodeTracker));

    await new ManagedAgentGraph(mockGraphDefinition).run(async () => ({
      content: '',
      metrics: { success: false, path: [], nodeMetrics: { n1: { success: false } } },
    }));

    expect(nodeTracker.trackError).toHaveBeenCalled();
    expect(nodeTracker.trackSuccess).not.toHaveBeenCalled();
  });

  it('skips node metrics when getNode returns undefined', async () => {
    mockGraphDefinition.getNode = jest.fn().mockReturnValue(undefined);

    const managedGraph = new ManagedAgentGraph(mockGraphDefinition);
    const result = await managedGraph.run(async () => ({
      content: '',
      metrics: {
        success: true,
        path: [],
        nodeMetrics: { missing: { success: true } },
      },
    }));

    expect(result.metrics.nodeMetrics).toEqual({});
  });

  it('passes graphDefinition and graphTracker to runner', async () => {
    const runnerFn = jest.fn().mockResolvedValue({
      content: 'output',
      metrics: { success: true, path: [], nodeMetrics: {} },
    });

    await new ManagedAgentGraph(mockGraphDefinition).run(runnerFn);

    expect(runnerFn).toHaveBeenCalledWith(mockGraphDefinition, mockGraphTracker);
  });

  it('creates a tracker via graphDefinition.createTracker()', async () => {
    await new ManagedAgentGraph(mockGraphDefinition).run(async () => ({
      content: '',
      metrics: { success: true, path: [], nodeMetrics: {} },
    }));

    expect(mockGraphDefinition.createTracker).toHaveBeenCalled();
  });

  it('resolves to empty evaluations by default', async () => {
    const result = await new ManagedAgentGraph(mockGraphDefinition).run(async () => ({
      content: '',
      metrics: { success: true, path: [], nodeMetrics: {} },
    }));

    expect(await result.evaluations).toEqual([]);
  });

  it('returns the graph definition via getGraphDefinition', () => {
    expect(new ManagedAgentGraph(mockGraphDefinition).getGraphDefinition()).toBe(
      mockGraphDefinition,
    );
  });
});
