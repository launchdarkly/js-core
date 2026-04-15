import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { AgentGraphDefinition } from '../src/api/graph/AgentGraphDefinition';
import { LDAIClientImpl } from '../src/LDAIClientImpl';
import { LDClientMin } from '../src/LDClientMin';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTrack = jest.fn();
const mockVariation = jest.fn();
const mockDebug = jest.fn();

const mockLdClient: LDClientMin = {
  track: mockTrack,
  variation: mockVariation,
  logger: {
    debug: mockDebug,
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
};

const testContext: LDContext = { kind: 'user', key: 'test-user' };

const makeClient = () => new LDAIClientImpl(mockLdClient);

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGraphFlagValue(
  root: string,
  edges: Record<string, Array<{ key: string }>> = {},
  variationKey = 'v1',
  version = 1,
) {
  return { _ldMeta: { variationKey, version }, root, edges };
}

function makeAgentFlagValue(key: string, enabled = true) {
  return {
    _ldMeta: { variationKey: `${key}-v1`, enabled, version: 1, mode: 'agent' },
    instructions: `Instructions for ${key}`,
  };
}

// ---------------------------------------------------------------------------
// agentGraph – disabled / validation failures
// ---------------------------------------------------------------------------

it('returns { enabled: false } when graph flag has no root', async () => {
  const client = makeClient();
  mockVariation.mockResolvedValueOnce({ root: '' }); // no root
  const result = await client.agentGraph('my-graph', testContext);
  expect(result.enabled).toBe(false);
});

it('logs debug when graph has no root', async () => {
  const client = makeClient();
  mockVariation.mockResolvedValueOnce({ root: '' });
  await client.agentGraph('my-graph', testContext);
  expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('not fetchable'));
});

it('returns { enabled: false } when a node is unconnected (not reachable from root)', async () => {
  const client = makeClient();
  // Graph says root → child, but "orphan" appears in edges with no path from root
  const graphValue = makeGraphFlagValue('root', {
    root: [{ key: 'child' }],
    orphan: [{ key: 'other' }], // orphan is not reachable from root
  });
  mockVariation.mockResolvedValueOnce(graphValue);
  const result = await client.agentGraph('my-graph', testContext);
  expect(result.enabled).toBe(false);
  expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('unconnected node'));
});

it('returns { enabled: false } when a child agent config is disabled', async () => {
  const client = makeClient();
  const graphValue = makeGraphFlagValue('root', { root: [{ key: 'child' }] });
  mockVariation
    .mockResolvedValueOnce(graphValue) // graph flag
    .mockResolvedValueOnce(makeAgentFlagValue('root', true)) // root agent config
    .mockResolvedValueOnce(makeAgentFlagValue('child', false)); // child is disabled
  const result = await client.agentGraph('my-graph', testContext);
  expect(result.enabled).toBe(false);
  expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('not enabled'));
});

// ---------------------------------------------------------------------------
// agentGraph – success path
// ---------------------------------------------------------------------------

it('returns { enabled: true, graph } for a valid graph with a single node', async () => {
  const client = makeClient();
  const graphValue = makeGraphFlagValue('solo-agent');
  mockVariation
    .mockResolvedValueOnce(graphValue)
    .mockResolvedValueOnce(makeAgentFlagValue('solo-agent'));
  const result = await client.agentGraph('my-graph', testContext);
  expect(result.enabled).toBe(true);
  if (result.enabled) {
    expect(result.graph).toBeInstanceOf(AgentGraphDefinition);
    expect(result.graph.rootNode().getKey()).toBe('solo-agent');
  }
});

it('returns a valid AgentGraphDefinition with correct nodes for multi-node graph', async () => {
  const client = makeClient();
  const graphValue = makeGraphFlagValue('root', {
    root: [{ key: 'child-a' }, { key: 'child-b' }],
    'child-a': [{ key: 'leaf' }],
  });
  // variation is called for: graph flag + root + child-a + child-b + leaf (order may vary)
  mockVariation
    .mockResolvedValueOnce(graphValue)
    .mockResolvedValue(makeAgentFlagValue('agent', true)); // all agent configs succeed

  const result = await client.agentGraph('my-graph', testContext);
  expect(result.enabled).toBe(true);
  if (result.enabled) {
    const { graph } = result;
    expect(graph.rootNode().getKey()).toBe('root');
    expect(
      graph
        .getChildNodes('root')
        .map((n) => n.getKey())
        .sort(),
    ).toEqual(['child-a', 'child-b']);
    expect(
      graph
        .terminalNodes()
        .map((n) => n.getKey())
        .sort(),
    ).toEqual(['child-b', 'leaf']);
  }
});

it('tracks usage event when agentGraph is called', async () => {
  const client = makeClient();
  mockVariation.mockResolvedValue({ root: '' });
  await client.agentGraph('my-graph', testContext);
  expect(mockTrack).toHaveBeenCalledWith('$ld:ai:usage:agent-graph', testContext, 'my-graph', 1);
});

it('createTracker on returned graph produces a tracker with correct graphKey', async () => {
  const client = makeClient();
  const graphValue = makeGraphFlagValue('root', {}, 'varKey', 3);
  mockVariation
    .mockResolvedValueOnce(graphValue)
    .mockResolvedValueOnce(makeAgentFlagValue('root', true));

  const result = await client.agentGraph('graph-key', testContext);
  expect(result.enabled).toBe(true);
  if (result.enabled) {
    const tracker = result.graph.createTracker();
    expect(tracker.getTrackData().graphKey).toBe('graph-key');
    expect(tracker.getTrackData().version).toBe(3);
    expect(tracker.getTrackData().variationKey).toBe('varKey');
  }
});

// ---------------------------------------------------------------------------
// createGraphTracker
// ---------------------------------------------------------------------------

it('createGraphTracker reconstructs a tracker from a resumption token', async () => {
  const client = makeClient();
  const graphValue = makeGraphFlagValue('root', {}, 'v99', 7);
  mockVariation
    .mockResolvedValueOnce(graphValue)
    .mockResolvedValueOnce(makeAgentFlagValue('root', true));

  const result = await client.agentGraph('g-key', testContext);
  expect(result.enabled).toBe(true);
  if (result.enabled) {
    const originalTracker = result.graph.createTracker();
    const token = originalTracker.resumptionToken;

    const reconstructed = client.createGraphTracker(token, testContext);
    expect(reconstructed.getTrackData().graphKey).toBe('g-key');
    expect(reconstructed.getTrackData().version).toBe(7);
    expect(reconstructed.getTrackData().variationKey).toBe('v99');
    expect(reconstructed.getTrackData().runId).toBe(originalTracker.getTrackData().runId);
  }
});
