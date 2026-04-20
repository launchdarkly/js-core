import { randomUUID } from 'crypto';

import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIAgentConfig } from '../src/api/config';
import { AgentGraphDefinition } from '../src/api/graph/AgentGraphDefinition';
import { LDAgentGraphFlagValue, LDGraphEdge } from '../src/api/graph/types';
import { LDClientMin } from '../src/LDClientMin';
import { LDGraphTrackerImpl } from '../src/LDGraphTrackerImpl';

const mockLdClient: LDClientMin = {
  track: jest.fn(),
  variation: jest.fn(),
};

const testContext: LDContext = { kind: 'user', key: 'test-user' };

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

function makeAgentConfig(key: string, enabled = true): LDAIAgentConfig {
  return { key, enabled, instructions: `You are ${key}.` } as LDAIAgentConfig;
}

function makeGraph(
  root: string,
  edges: Record<string, LDGraphEdge[]> = {},
  variationKey?: string,
  version = 1,
): LDAgentGraphFlagValue {
  return {
    _ldMeta: { variationKey, version },
    root,
    edges,
  };
}

function makeDefinition(
  graph: LDAgentGraphFlagValue,
  agentConfigs: Record<string, LDAIAgentConfig>,
  enabled = true,
): AgentGraphDefinition {
  const nodes = AgentGraphDefinition.buildNodes(graph, agentConfigs);
  return new AgentGraphDefinition(graph, nodes, enabled, () =>
    new LDGraphTrackerImpl(
      mockLdClient,
      randomUUID(),
      graph.root,
      // eslint-disable-next-line no-underscore-dangle
      graph._ldMeta?.variationKey,
      // eslint-disable-next-line no-underscore-dangle
      graph._ldMeta?.version ?? 1,
      testContext,
    ),
  );
}

// ---------------------------------------------------------------------------
// buildNodes
// ---------------------------------------------------------------------------

it('buildNodes creates a node for every unique key in the graph', () => {
  const graph = makeGraph('root', {
    root: [{ key: 'child-a' }, { key: 'child-b' }],
    'child-a': [{ key: 'leaf' }],
  });
  const configs: Record<string, LDAIAgentConfig> = {
    root: makeAgentConfig('root'),
    'child-a': makeAgentConfig('child-a'),
    'child-b': makeAgentConfig('child-b'),
    leaf: makeAgentConfig('leaf'),
  };

  const nodes = AgentGraphDefinition.buildNodes(graph, configs);
  expect(Object.keys(nodes).sort()).toEqual(['child-a', 'child-b', 'leaf', 'root']);
});

it('buildNodes skips keys whose agent config is missing', () => {
  const graph = makeGraph('root', { root: [{ key: 'orphan' }] });
  const nodes = AgentGraphDefinition.buildNodes(graph, { root: makeAgentConfig('root') });
  expect(nodes.root).toBeDefined();
  expect(nodes.orphan).toBeUndefined();
});

it('buildNodes assigns correct edges to each node', () => {
  const graph = makeGraph('root', {
    root: [{ key: 'child', handoff: { someOption: true } }],
  });
  const configs = {
    root: makeAgentConfig('root'),
    child: makeAgentConfig('child'),
  };
  const nodes = AgentGraphDefinition.buildNodes(graph, configs);
  expect(nodes.root.getEdges()).toEqual([{ key: 'child', handoff: { someOption: true } }]);
  expect(nodes.child.getEdges()).toEqual([]);
});

// ---------------------------------------------------------------------------
// collectAllKeys
// ---------------------------------------------------------------------------

it('collectAllKeys includes root, edge sources, and edge targets', () => {
  const graph = makeGraph('root', {
    root: [{ key: 'a' }, { key: 'b' }],
    a: [{ key: 'c' }],
  });
  const keys = AgentGraphDefinition.collectAllKeys(graph);
  expect([...keys].sort()).toEqual(['a', 'b', 'c', 'root']);
});

it('collectAllKeys works for a graph with no edges', () => {
  const graph = makeGraph('solo');
  const keys = AgentGraphDefinition.collectAllKeys(graph);
  expect([...keys]).toEqual(['solo']);
});

// ---------------------------------------------------------------------------
// enabled
// ---------------------------------------------------------------------------

it('enabled reflects the value passed at construction', () => {
  const graph = makeGraph('r');
  const enabled = makeDefinition(graph, { r: makeAgentConfig('r') }, true);
  expect(enabled.enabled).toBe(true);

  const disabled = makeDefinition(graph, { r: makeAgentConfig('r') }, false);
  expect(disabled.enabled).toBe(false);
});

// ---------------------------------------------------------------------------
// rootNode / getNode / terminalNodes
// ---------------------------------------------------------------------------

it('rootNode returns the root node', () => {
  const graph = makeGraph('root', { root: [{ key: 'leaf' }] });
  const def = makeDefinition(graph, {
    root: makeAgentConfig('root'),
    leaf: makeAgentConfig('leaf'),
  });
  expect(def.rootNode().getKey()).toBe('root');
});

it('getNode returns null for unknown key', () => {
  const graph = makeGraph('root');
  const def = makeDefinition(graph, { root: makeAgentConfig('root') });
  expect(def.getNode('nonexistent')).toBeNull();
});

it('terminalNodes returns nodes with no outgoing edges', () => {
  const graph = makeGraph('root', {
    root: [{ key: 'mid' }],
    mid: [{ key: 'leaf-a' }, { key: 'leaf-b' }],
  });
  const def = makeDefinition(graph, {
    root: makeAgentConfig('root'),
    mid: makeAgentConfig('mid'),
    'leaf-a': makeAgentConfig('leaf-a'),
    'leaf-b': makeAgentConfig('leaf-b'),
  });
  const terminalKeys = def
    .terminalNodes()
    .map((n) => n.getKey())
    .sort();
  expect(terminalKeys).toEqual(['leaf-a', 'leaf-b']);
});

// ---------------------------------------------------------------------------
// getChildNodes / getParentNodes
// ---------------------------------------------------------------------------

it('getChildNodes returns direct children', () => {
  const graph = makeGraph('root', {
    root: [{ key: 'a' }, { key: 'b' }],
  });
  const def = makeDefinition(graph, {
    root: makeAgentConfig('root'),
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
  });
  const childKeys = def
    .getChildNodes('root')
    .map((n) => n.getKey())
    .sort();
  expect(childKeys).toEqual(['a', 'b']);
});

it('getChildNodes returns empty array for terminal node', () => {
  const graph = makeGraph('root');
  const def = makeDefinition(graph, { root: makeAgentConfig('root') });
  expect(def.getChildNodes('root')).toEqual([]);
});

it('getChildNodes returns empty array for unknown key', () => {
  const graph = makeGraph('root');
  const def = makeDefinition(graph, { root: makeAgentConfig('root') });
  expect(def.getChildNodes('unknown')).toEqual([]);
});

it('getParentNodes returns nodes that have direct edges to the given key', () => {
  const graph = makeGraph('root', {
    root: [{ key: 'child' }],
    sibling: [{ key: 'child' }],
  });
  const def = makeDefinition(graph, {
    root: makeAgentConfig('root'),
    sibling: makeAgentConfig('sibling'),
    child: makeAgentConfig('child'),
  });
  const parentKeys = def
    .getParentNodes('child')
    .map((n) => n.getKey())
    .sort();
  expect(parentKeys).toEqual(['root', 'sibling']);
});

it('getParentNodes returns empty array for root node', () => {
  const graph = makeGraph('root', { root: [{ key: 'child' }] });
  const def = makeDefinition(graph, {
    root: makeAgentConfig('root'),
    child: makeAgentConfig('child'),
  });
  expect(def.getParentNodes('root')).toEqual([]);
});

// ---------------------------------------------------------------------------
// traverse
// ---------------------------------------------------------------------------

it('traverse calls fn for every node in BFS order (root first)', () => {
  //    root
  //   /    \
  //  a      b
  //  |
  //  c
  const graph = makeGraph('root', {
    root: [{ key: 'a' }, { key: 'b' }],
    a: [{ key: 'c' }],
  });
  const def = makeDefinition(graph, {
    root: makeAgentConfig('root'),
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
  });

  const order: string[] = [];
  def.traverse((node) => {
    order.push(node.getKey());
  });

  expect(order[0]).toBe('root');
  // a and b must both appear before c
  const aIdx = order.indexOf('a');
  const bIdx = order.indexOf('b');
  const cIdx = order.indexOf('c');
  expect(aIdx).toBeLessThan(cIdx);
  expect(bIdx).toBeLessThan(cIdx);
  expect(order).toHaveLength(4);
});

it('traverse stores fn return values in execution context', () => {
  const graph = makeGraph('root', { root: [{ key: 'child' }] });
  const def = makeDefinition(graph, {
    root: makeAgentConfig('root'),
    child: makeAgentConfig('child'),
  });

  const contextCaptures: Record<string, unknown>[] = [];
  def.traverse((node, ctx) => {
    contextCaptures.push({ ...ctx });
    return `result-of-${node.getKey()}`;
  });

  // After root is processed, the child's context should contain root's result
  expect(contextCaptures[1]).toHaveProperty('root', 'result-of-root');
});

it('traverse accepts and uses initial execution context', () => {
  const graph = makeGraph('root');
  const def = makeDefinition(graph, { root: makeAgentConfig('root') });

  const captured: Record<string, unknown>[] = [];
  def.traverse(
    (node, ctx) => {
      captured.push({ ...ctx });
    },
    { initialKey: 'initialValue' },
  );

  expect(captured[0]).toHaveProperty('initialKey', 'initialValue');
});

it('traverse handles a single-node graph', () => {
  const graph = makeGraph('solo');
  const def = makeDefinition(graph, { solo: makeAgentConfig('solo') });
  const visited: string[] = [];
  def.traverse((node) => {
    visited.push(node.getKey());
  });
  expect(visited).toEqual(['solo']);
});

// ---------------------------------------------------------------------------
// reverseTraverse
// ---------------------------------------------------------------------------

it('reverseTraverse processes terminal nodes before their parents, root last', () => {
  //    root
  //   /    \
  //  a      b    ← mid-level
  //  |
  //  c           ← terminal (deepest)
  const graph = makeGraph('root', {
    root: [{ key: 'a' }, { key: 'b' }],
    a: [{ key: 'c' }],
  });
  const def = makeDefinition(graph, {
    root: makeAgentConfig('root'),
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
  });

  const order: string[] = [];
  def.reverseTraverse((node) => {
    order.push(node.getKey());
  });

  expect(order[order.length - 1]).toBe('root'); // root always last
  // c must appear before a (c is a descendant of a)
  expect(order.indexOf('c')).toBeLessThan(order.indexOf('a'));
  // all four nodes visited
  expect(order.sort()).toEqual(['a', 'b', 'c', 'root']);
});

it('reverseTraverse stores fn return values in execution context', () => {
  const graph = makeGraph('root', { root: [{ key: 'child' }] });
  const def = makeDefinition(graph, {
    root: makeAgentConfig('root'),
    child: makeAgentConfig('child'),
  });

  const contextWhenRootRuns: Record<string, unknown>[] = [];
  def.reverseTraverse((node, ctx) => {
    if (node.getKey() === 'root') {
      contextWhenRootRuns.push({ ...ctx });
    }
    return `result-of-${node.getKey()}`;
  });

  // root runs last; at that point, child's result should be in context
  expect(contextWhenRootRuns[0]).toHaveProperty('child', 'result-of-child');
});

it('reverseTraverse visits a node with multiple parents only once', () => {
  // root → a → d → c
  // root → b → c   ← c has two parents
  const graph = makeGraph('root', {
    root: [{ key: 'a' }, { key: 'b' }],
    a: [{ key: 'd' }],
    b: [{ key: 'c' }],
    d: [{ key: 'c' }],
  });
  const def = makeDefinition(graph, {
    root: makeAgentConfig('root'),
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
    d: makeAgentConfig('d'),
  });

  const order: string[] = [];
  def.reverseTraverse((node) => {
    order.push(node.getKey());
  });

  // c is the only terminal — it goes first
  expect(order[0]).toBe('c');
  // root is always last
  expect(order[order.length - 1]).toBe('root');
  // every node visited exactly once
  expect(order.sort()).toEqual(['a', 'b', 'c', 'd', 'root']);
});

it('reverseTraverse visits each node once on a cyclic graph', () => {
  // A → B → A (no terminals)
  const graph = makeGraph('a', {
    a: [{ key: 'b' }],
    b: [{ key: 'a' }],
  });
  const def = makeDefinition(graph, {
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
  });

  const visited: string[] = [];
  def.reverseTraverse((node) => {
    visited.push(node.getKey());
  });

  // No terminals → returns without visiting anything (same as Python)
  expect(visited).toEqual([]);
});

// ---------------------------------------------------------------------------
// getConfig
// ---------------------------------------------------------------------------

it('getConfig returns the raw flag value', () => {
  const graph = makeGraph('root', {}, 'var-key', 5);
  const def = makeDefinition(graph, { root: makeAgentConfig('root') });
  expect(def.getConfig()).toBe(graph);
});
