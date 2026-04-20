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

it('returns a disabled graph when _ldMeta.enabled is false', async () => {
  const client = makeClient();
  mockVariation.mockResolvedValueOnce({ _ldMeta: { enabled: false }, root: 'root' });
  const graph = await client.agentGraph('my-graph', testContext);
  expect(graph).toBeInstanceOf(AgentGraphDefinition);
  expect(graph.enabled).toBe(false);
});

it('logs debug when graph is disabled via _ldMeta.enabled', async () => {
  const client = makeClient();
  mockVariation.mockResolvedValueOnce({ _ldMeta: { enabled: false }, root: 'root' });
  await client.agentGraph('my-graph', testContext);
  expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('disabled'));
});

it('returns a disabled graph when graph flag has no root', async () => {
  const client = makeClient();
  mockVariation.mockResolvedValueOnce({ root: '' });
  const graph = await client.agentGraph('my-graph', testContext);
  expect(graph).toBeInstanceOf(AgentGraphDefinition);
  expect(graph.enabled).toBe(false);
});

it('logs debug when graph has no root', async () => {
  const client = makeClient();
  mockVariation.mockResolvedValueOnce({ root: '' });
  await client.agentGraph('my-graph', testContext);
  expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('not fetchable'));
});

it('returns a disabled graph when a node is unconnected (not reachable from root)', async () => {
  const client = makeClient();
  const graphValue = makeGraphFlagValue('root', {
    root: [{ key: 'child' }],
    orphan: [{ key: 'other' }],
  });
  mockVariation.mockResolvedValueOnce(graphValue);
  const graph = await client.agentGraph('my-graph', testContext);
  expect(graph).toBeInstanceOf(AgentGraphDefinition);
  expect(graph.enabled).toBe(false);
  expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('unconnected node'));
});

it('returns an enabled graph and traverses a cyclic graph (each node visited once)', async () => {
  const client = makeClient();
  const graphValue = makeGraphFlagValue('a', {
    a: [{ key: 'b' }],
    b: [{ key: 'a' }],
  });
  mockVariation
    .mockResolvedValueOnce(graphValue)
    .mockResolvedValue(makeAgentFlagValue('agent', true));

  const graph = await client.agentGraph('my-graph', testContext);
  expect(graph.enabled).toBe(true);

  const visited: string[] = [];
  graph.traverse((node) => {
    visited.push(node.getKey());
  });
  expect(visited.sort()).toEqual(['a', 'b']);
});

it('returns a disabled graph when a child agent config is disabled', async () => {
  const client = makeClient();
  const graphValue = makeGraphFlagValue('root', { root: [{ key: 'child' }] });
  mockVariation
    .mockResolvedValueOnce(graphValue)
    .mockResolvedValueOnce(makeAgentFlagValue('root', true))
    .mockResolvedValueOnce(makeAgentFlagValue('child', false));
  const graph = await client.agentGraph('my-graph', testContext);
  expect(graph).toBeInstanceOf(AgentGraphDefinition);
  expect(graph.enabled).toBe(false);
  expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining('not enabled'));
});

// ---------------------------------------------------------------------------
// agentGraph – success path
// ---------------------------------------------------------------------------

it('returns an enabled graph for a valid graph with a single node', async () => {
  const client = makeClient();
  const graphValue = makeGraphFlagValue('solo-agent');
  mockVariation
    .mockResolvedValueOnce(graphValue)
    .mockResolvedValueOnce(makeAgentFlagValue('solo-agent'));
  const graph = await client.agentGraph('my-graph', testContext);
  expect(graph).toBeInstanceOf(AgentGraphDefinition);
  expect(graph.enabled).toBe(true);
  expect(graph.rootNode().getKey()).toBe('solo-agent');
});

it('returns an enabled graph with correct nodes for multi-node graph', async () => {
  const client = makeClient();
  const graphValue = makeGraphFlagValue('root', {
    root: [{ key: 'child-a' }, { key: 'child-b' }],
    'child-a': [{ key: 'leaf' }],
  });
  mockVariation
    .mockResolvedValueOnce(graphValue)
    .mockResolvedValue(makeAgentFlagValue('agent', true));

  const graph = await client.agentGraph('my-graph', testContext);
  expect(graph.enabled).toBe(true);
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
});

it('tracks usage event when agentGraph is called', async () => {
  const client = makeClient();
  mockVariation.mockResolvedValue({ root: '' });
  await client.agentGraph('my-graph', testContext);
  expect(mockTrack).toHaveBeenCalledWith('$ld:ai:usage:agent-graph', testContext, 'my-graph', 1);
});

// ---------------------------------------------------------------------------
// createGraphTracker
// ---------------------------------------------------------------------------

it('createGraphTracker reconstructs a tracker from a resumption token', () => {
  const client = makeClient();
  const token = Buffer.from(
    '{"runId":"run-1","graphKey":"g-key","variationKey":"v99","version":7}',
  ).toString('base64url');

  const tracker = client.createGraphTracker(token, testContext);

  expect(tracker.getTrackData().graphKey).toBe('g-key');
  expect(tracker.getTrackData().version).toBe(7);
  expect(tracker.getTrackData().variationKey).toBe('v99');
  expect(tracker.getTrackData().runId).toBe('run-1');
});
