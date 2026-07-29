import { randomUUID } from 'crypto';

import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIAgentConfig } from '../src/api/config';
import { AgentGraphDefinition } from '../src/api/graph/AgentGraphDefinition';
import { AgentGraphNode } from '../src/api/graph/AgentGraphNode';
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
  return new AgentGraphDefinition(
    graph,
    nodes,
    enabled,
    () =>
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

it('traverse visits every node with predecessors before dependents (root first)', () => {
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
  // a and b must both appear before c (sibling order among a/b is not significant)
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
  expect([...order].sort()).toEqual(['a', 'b', 'c', 'root']);
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
  expect([...order].sort()).toEqual(['a', 'b', 'c', 'd', 'root']);
});

it('reverseTraverse accepts and uses initial execution context', () => {
  const graph = makeGraph('root', { root: [{ key: 'child' }] });
  const def = makeDefinition(graph, {
    root: makeAgentConfig('root'),
    child: makeAgentConfig('child'),
  });

  const captured: Record<string, unknown>[] = [];
  def.reverseTraverse(
    (node, ctx) => {
      captured.push({ ...ctx });
      return `result-of-${node.getKey()}`;
    },
    { initialKey: 'initialValue' },
  );

  expect(captured[0]).toHaveProperty('initialKey', 'initialValue');
});

it('reverseTraverse visits each node once on a cyclic graph with root last', () => {
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

  expect(visited).toHaveLength(2);
  expect(visited[visited.length - 1]).toBe('a');
  expect([...visited].sort()).toEqual(['a', 'b']);
});

// ---------------------------------------------------------------------------
// Topological parity fixtures (G1–G6)
// ---------------------------------------------------------------------------

function collectOrder(
  def: AgentGraphDefinition,
  direction: 'forward' | 'reverse',
): string[] {
  const order: string[] = [];
  const fn = (node: AgentGraphNode) => {
    order.push(node.getKey());
  };
  if (direction === 'forward') {
    def.traverse(fn);
  } else {
    def.reverseTraverse(fn);
  }
  return order;
}

/** Canonical G1–G6/G2b vectors from sdk-specs AIGRAPH test-vectors/vectors.json. */
type TraversalVector = {
  id: string;
  root: string;
  nodes: string[];
  edges: [string, string][];
  traverse: string[];
  reverseTraverse: string[];
  traverseContext: Record<string, string[]>;
  reverseTraverseContext: Record<string, string[]>;
};

const TRAVERSAL_VECTORS: TraversalVector[] = [
  {
    id: 'G1',
    root: 'a',
    nodes: ['a', 'b', 'c'],
    edges: [
      ['a', 'b'],
      ['b', 'c'],
    ],
    traverse: ['a', 'b', 'c'],
    reverseTraverse: ['c', 'b', 'a'],
    traverseContext: { a: [], b: ['a'], c: ['a', 'b'] },
    reverseTraverseContext: { a: ['b', 'c'], b: ['c'], c: [] },
  },
  {
    id: 'G2',
    root: 'a',
    nodes: ['a', 'b', 'c', 'd', 'e'],
    edges: [
      ['a', 'b'],
      ['a', 'c'],
      ['c', 'd'],
      ['d', 'e'],
      ['b', 'e'],
    ],
    traverse: ['a', 'b', 'c', 'd', 'e'],
    reverseTraverse: ['e', 'b', 'd', 'c', 'a'],
    traverseContext: {
      a: [],
      b: ['a'],
      c: ['a'],
      d: ['a', 'c'],
      e: ['a', 'b', 'c', 'd'],
    },
    reverseTraverseContext: {
      a: ['b', 'c', 'd', 'e'],
      b: ['e'],
      c: ['d', 'e'],
      d: ['e'],
      e: [],
    },
  },
  {
    id: 'G2b',
    root: 'a',
    nodes: ['a', 'b', 'c', 'd', 'e'],
    edges: [
      ['a', 'c'],
      ['a', 'b'],
      ['c', 'd'],
      ['d', 'e'],
      ['b', 'e'],
    ],
    traverse: ['a', 'c', 'b', 'd', 'e'],
    reverseTraverse: ['e', 'b', 'd', 'c', 'a'],
    traverseContext: {
      a: [],
      b: ['a'],
      c: ['a'],
      d: ['a', 'c'],
      e: ['a', 'b', 'c', 'd'],
    },
    reverseTraverseContext: {
      a: ['b', 'c', 'd', 'e'],
      b: ['e'],
      c: ['d', 'e'],
      d: ['e'],
      e: [],
    },
  },
  {
    id: 'G3',
    root: 'a',
    nodes: ['a', 'b', 'c', 'd'],
    edges: [
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'd'],
      ['c', 'd'],
    ],
    traverse: ['a', 'b', 'c', 'd'],
    reverseTraverse: ['d', 'b', 'c', 'a'],
    traverseContext: {
      a: [],
      b: ['a'],
      c: ['a'],
      d: ['a', 'b', 'c'],
    },
    reverseTraverseContext: {
      a: ['b', 'c', 'd'],
      b: ['d'],
      c: ['d'],
      d: [],
    },
  },
  {
    id: 'G4',
    root: 'a',
    nodes: ['a', 'n', 'm', 't'],
    edges: [
      ['a', 'n'],
      ['n', 'm'],
      ['n', 't'],
      ['m', 't'],
    ],
    traverse: ['a', 'n', 'm', 't'],
    reverseTraverse: ['t', 'm', 'n', 'a'],
    traverseContext: {
      a: [],
      n: ['a'],
      m: ['a', 'n'],
      t: ['a', 'm', 'n'],
    },
    reverseTraverseContext: {
      a: ['m', 'n', 't'],
      n: ['m', 't'],
      m: ['t'],
      t: [],
    },
  },
  {
    id: 'G5',
    root: 'a',
    nodes: ['a', 'b', 'c', 'd'],
    edges: [
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'd'],
    ],
    traverse: ['a', 'b', 'c', 'd'],
    reverseTraverse: ['c', 'd', 'b', 'a'],
    traverseContext: {
      a: [],
      b: ['a'],
      c: ['a'],
      d: ['a', 'b'],
    },
    reverseTraverseContext: {
      a: ['b', 'c', 'd'],
      b: ['d'],
      c: [],
      d: [],
    },
  },
  {
    id: 'G6',
    root: 'a',
    nodes: ['a', 'b', 'c'],
    edges: [
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'b'],
    ],
    traverse: ['a', 'b', 'c'],
    reverseTraverse: ['b', 'c', 'a'],
    traverseContext: { a: [], b: ['a'], c: ['a', 'b'] },
    reverseTraverseContext: { a: ['b', 'c'], b: [], c: ['b'] },
  },
];

/** Converts [src, tgt] pairs into makeGraph edges, preserving declaration order. */
function edgesFromPairs(pairs: [string, string][]): Record<string, LDGraphEdge[]> {
  const edges: Record<string, LDGraphEdge[]> = {};
  for (const [src, tgt] of pairs) {
    if (!edges[src]) {
      edges[src] = [];
    }
    edges[src].push({ key: tgt });
  }
  return edges;
}

function makeDefinitionFromVector(v: TraversalVector): AgentGraphDefinition {
  const configs: Record<string, LDAIAgentConfig> = {};
  for (const key of v.nodes) {
    configs[key] = makeAgentConfig(key);
  }
  return makeDefinition(makeGraph(v.root, edgesFromPairs(v.edges)), configs);
}

it.each(TRAVERSAL_VECTORS)(
  '$id asserts traverse/reverse order and exact scoped context',
  (v) => {
    const def = makeDefinitionFromVector(v);

    const fwdOrder: string[] = [];
    const fwdCtx: Record<string, string[]> = {};
    def.traverse((node, ctx) => {
      const key = node.getKey();
      fwdOrder.push(key);
      fwdCtx[key] = Object.keys(ctx).sort();
      return `${key}-result`;
    });
    expect(fwdOrder).toEqual(v.traverse);
    for (const [key, expected] of Object.entries(v.traverseContext)) {
      expect(fwdCtx[key]).toEqual([...expected].sort());
    }

    const revOrder: string[] = [];
    const revCtx: Record<string, string[]> = {};
    def.reverseTraverse((node, ctx) => {
      const key = node.getKey();
      revOrder.push(key);
      revCtx[key] = Object.keys(ctx).sort();
      return `${key}-result`;
    });
    expect(revOrder).toEqual(v.reverseTraverse);
    for (const [key, expected] of Object.entries(v.reverseTraverseContext)) {
      expect(revCtx[key]).toEqual([...expected].sort());
    }
  },
);

describe('given G1 linear graph a→b→c', () => {
  const graph = makeGraph('a', {
    a: [{ key: 'b' }],
    b: [{ key: 'c' }],
  });
  const configs = {
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
  };
  const def = makeDefinition(graph, configs);

  it('traverse visits a, b, c', () => {
    expect(collectOrder(def, 'forward')).toEqual(['a', 'b', 'c']);
  });

  it('reverseTraverse visits c, b, a', () => {
    expect(collectOrder(def, 'reverse')).toEqual(['c', 'b', 'a']);
  });
});

describe('given G2 skewed diamond a→b, a→c, c→d, d→e, b→e', () => {
  const graph = makeGraph('a', {
    a: [{ key: 'b' }, { key: 'c' }],
    b: [{ key: 'e' }],
    c: [{ key: 'd' }],
    d: [{ key: 'e' }],
  });
  const configs = {
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
    d: makeAgentConfig('d'),
    e: makeAgentConfig('e'),
  };
  const def = makeDefinition(graph, configs);

  it('traverse visits a, b, c, d, e', () => {
    expect(collectOrder(def, 'forward')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('reverseTraverse visits e, b, d, c, a', () => {
    expect(collectOrder(def, 'reverse')).toEqual(['e', 'b', 'd', 'c', 'a']);
  });

  it('traverse keeps e last when a edges are declared [c, b]', () => {
    const reordered = makeDefinition(
      makeGraph('a', {
        a: [{ key: 'c' }, { key: 'b' }],
        b: [{ key: 'e' }],
        c: [{ key: 'd' }],
        d: [{ key: 'e' }],
      }),
      configs,
    );
    const order = collectOrder(reordered, 'forward');
    expect(order).toEqual(['a', 'c', 'b', 'd', 'e']);
    expect(order.indexOf('d')).toBeLessThan(order.indexOf('e'));
  });

  it('reverseTraverse keeps e before d when a edges are declared [c, b]', () => {
    const reordered = makeDefinition(
      makeGraph('a', {
        a: [{ key: 'c' }, { key: 'b' }],
        b: [{ key: 'e' }],
        c: [{ key: 'd' }],
        d: [{ key: 'e' }],
      }),
      configs,
    );
    const order = collectOrder(reordered, 'reverse');
    expect(order[0]).toBe('e');
    expect(order.indexOf('e')).toBeLessThan(order.indexOf('d'));
    expect(order.indexOf('e')).toBeLessThan(order.indexOf('b'));
    expect(order[order.length - 1]).toBe('a');
  });
});

describe('given G3 symmetric diamond a→b, a→c, b→d, c→d', () => {
  const graph = makeGraph('a', {
    a: [{ key: 'b' }, { key: 'c' }],
    b: [{ key: 'd' }],
    c: [{ key: 'd' }],
  });
  const def = makeDefinition(graph, {
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
    d: makeAgentConfig('d'),
  });

  it('traverse visits a, b, c, d', () => {
    expect(collectOrder(def, 'forward')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('reverseTraverse visits d, b, c, a', () => {
    expect(collectOrder(def, 'reverse')).toEqual(['d', 'b', 'c', 'a']);
  });
});

describe('given G4 nested-parent a→n, n→m, n→t, m→t', () => {
  const graph = makeGraph('a', {
    a: [{ key: 'n' }],
    n: [{ key: 'm' }, { key: 't' }],
    m: [{ key: 't' }],
  });
  const def = makeDefinition(graph, {
    a: makeAgentConfig('a'),
    n: makeAgentConfig('n'),
    m: makeAgentConfig('m'),
    t: makeAgentConfig('t'),
  });

  it('traverse visits a, n, m, t', () => {
    expect(collectOrder(def, 'forward')).toEqual(['a', 'n', 'm', 't']);
  });

  it('reverseTraverse visits t, m, n, a', () => {
    expect(collectOrder(def, 'reverse')).toEqual(['t', 'm', 'n', 'a']);
  });
});

describe('given G5 multi-terminal a→b, a→c, b→d', () => {
  const graph = makeGraph('a', {
    a: [{ key: 'b' }, { key: 'c' }],
    b: [{ key: 'd' }],
  });
  const def = makeDefinition(graph, {
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
    d: makeAgentConfig('d'),
  });

  it('traverse visits a, b, c, d', () => {
    expect(collectOrder(def, 'forward')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('reverseTraverse visits c, d, b, a', () => {
    expect(collectOrder(def, 'reverse')).toEqual(['c', 'd', 'b', 'a']);
  });
});

describe('given G6 cycle a→b, b→c, c→b', () => {
  const graph = makeGraph('a', {
    a: [{ key: 'b' }],
    b: [{ key: 'c' }],
    c: [{ key: 'b' }],
  });
  const def = makeDefinition(graph, {
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
  });

  it('traverse visits each node once with a first and a deterministic order', () => {
    const first = collectOrder(def, 'forward');
    const second = collectOrder(def, 'forward');
    expect(first[0]).toBe('a');
    expect(first).toHaveLength(3);
    expect([...first].sort()).toEqual(['a', 'b', 'c']);
    expect(first).toEqual(second);
  });

  it('reverseTraverse visits each node once with a last and a deterministic order', () => {
    const first = collectOrder(def, 'reverse');
    const second = collectOrder(def, 'reverse');
    expect(first[first.length - 1]).toBe('a');
    expect(first).toHaveLength(3);
    expect([...first].sort()).toEqual(['a', 'b', 'c']);
    expect(first).toEqual(second);
  });
});

it('traverse scopes context to exact predecessors on G2 skewed diamond', () => {
  // a→b, a→c, c→d, d→e, b→e
  const graph = makeGraph('a', {
    a: [{ key: 'b' }, { key: 'c' }],
    b: [{ key: 'e' }],
    c: [{ key: 'd' }],
    d: [{ key: 'e' }],
  });
  const def = makeDefinition(graph, {
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
    d: makeAgentConfig('d'),
    e: makeAgentConfig('e'),
  });

  const expectedKeys: Record<string, string[]> = {
    a: [],
    b: ['a'],
    c: ['a'],
    d: ['a', 'c'],
    e: ['a', 'b', 'c', 'd'],
  };

  def.traverse((node, ctx) => {
    expect(Object.keys(ctx).sort()).toEqual(expectedKeys[node.getKey()].sort());
    // Parallel-branch leak: b must not see sibling-branch node c
    if (node.getKey() === 'b') {
      expect(ctx).not.toHaveProperty('c');
    }
    // Parallel-branch leak: d must not see unrelated branch node b
    if (node.getKey() === 'd') {
      expect(ctx).not.toHaveProperty('b');
    }
    return `result-of-${node.getKey()}`;
  });
});

it('reverseTraverse scopes context to exact descendants on G2 skewed diamond', () => {
  const graph = makeGraph('a', {
    a: [{ key: 'b' }, { key: 'c' }],
    b: [{ key: 'e' }],
    c: [{ key: 'd' }],
    d: [{ key: 'e' }],
  });
  const def = makeDefinition(graph, {
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
    d: makeAgentConfig('d'),
    e: makeAgentConfig('e'),
  });

  const expectedKeys: Record<string, string[]> = {
    a: ['b', 'c', 'd', 'e'],
    b: ['e'],
    c: ['d', 'e'],
    d: ['e'],
    e: [],
  };

  def.reverseTraverse((node, ctx) => {
    expect(Object.keys(ctx).sort()).toEqual(expectedKeys[node.getKey()].sort());
    // Parallel-branch leak: b/d must not see c (not a descendant of either)
    if (node.getKey() === 'b' || node.getKey() === 'd') {
      expect(ctx).not.toHaveProperty('c');
    }
    return `result-of-${node.getKey()}`;
  });
});

it('traverse context scoping is independent of a edge declaration order on G2', () => {
  const configs = {
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
    d: makeAgentConfig('d'),
    e: makeAgentConfig('e'),
  };
  const def = makeDefinition(
    makeGraph('a', {
      a: [{ key: 'c' }, { key: 'b' }],
      b: [{ key: 'e' }],
      c: [{ key: 'd' }],
      d: [{ key: 'e' }],
    }),
    configs,
  );

  const expectedKeys: Record<string, string[]> = {
    a: [],
    b: ['a'],
    c: ['a'],
    d: ['a', 'c'],
    e: ['a', 'b', 'c', 'd'],
  };

  def.traverse((node, ctx) => {
    expect(Object.keys(ctx).sort()).toEqual(expectedKeys[node.getKey()].sort());
    return `result-of-${node.getKey()}`;
  });
});

it('traverse includes initial context keys alongside scoped predecessors', () => {
  const graph = makeGraph('a', {
    a: [{ key: 'b' }, { key: 'c' }],
    b: [{ key: 'e' }],
    c: [{ key: 'd' }],
    d: [{ key: 'e' }],
  });
  const def = makeDefinition(graph, {
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
    d: makeAgentConfig('d'),
    e: makeAgentConfig('e'),
  });

  const expectedDeps: Record<string, string[]> = {
    a: [],
    b: ['a'],
    c: ['a'],
    d: ['a', 'c'],
    e: ['a', 'b', 'c', 'd'],
  };

  def.traverse(
    (node, ctx) => {
      expect(Object.keys(ctx).sort()).toEqual(
        ['seed', ...expectedDeps[node.getKey()]].sort(),
      );
      expect(ctx).toHaveProperty('seed', 'value');
      return `result-of-${node.getKey()}`;
    },
    { seed: 'value' },
  );
});

it('traverse visits each node once on a self-loop without hanging', () => {
  const graph = makeGraph('a', {
    a: [{ key: 'a' }],
  });
  const def = makeDefinition(graph, { a: makeAgentConfig('a') });

  const order: string[] = [];
  def.traverse((node) => {
    order.push(node.getKey());
  });
  expect(order).toEqual(['a']);
});

it('traverse and reverseTraverse produce identical orders across repeated runs', () => {
  const graph = makeGraph('a', {
    a: [{ key: 'b' }, { key: 'c' }],
    b: [{ key: 'e' }],
    c: [{ key: 'd' }],
    d: [{ key: 'e' }],
  });
  const def = makeDefinition(graph, {
    a: makeAgentConfig('a'),
    b: makeAgentConfig('b'),
    c: makeAgentConfig('c'),
    d: makeAgentConfig('d'),
    e: makeAgentConfig('e'),
  });

  expect(collectOrder(def, 'forward')).toEqual(collectOrder(def, 'forward'));
  expect(collectOrder(def, 'reverse')).toEqual(collectOrder(def, 'reverse'));
});

// ---------------------------------------------------------------------------
// getConfig
// ---------------------------------------------------------------------------

it('getConfig returns the raw flag value', () => {
  const graph = makeGraph('root', {}, 'var-key', 5);
  const def = makeDefinition(graph, { root: makeAgentConfig('root') });
  expect(def.getConfig()).toBe(graph);
});
