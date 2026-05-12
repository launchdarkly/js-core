# Agent Graph Traversal Example

Demonstrates how to fetch an agent graph from LaunchDarkly and wire it into
an AI framework using forward or reverse traversal.

## Setup

```bash
export LAUNCHDARKLY_SDK_KEY=<your-sdk-key>
export LAUNCHDARKLY_GRAPH_KEY=sample-graph   # optional, this is the default
yarn start
```

## What it does

1. Fetches the graph flag and validates that it is enabled.
2. Runs a **forward traversal** (root → terminals), simulating how you would
   build agents in a framework that constructs parents before children.
3. Runs a **reverse traversal** (terminals → root), simulating how you would
   build agents in a framework that constructs children before parents.
4. Creates a tracker and records a successful invocation.

## Choosing a traversal direction

Both methods visit every node exactly once and pass an `executionContext` map
to each callback. The return value of your callback is stored under the node's
key, making it available to all subsequent nodes in that traversal.

### Forward traversal (`graph.traverse`)

Processes nodes from the root down to the terminals (BFS order). Use this when
your framework requires a **parent to be defined first** so that child agents
can be registered as handoff targets on it afterward.

```
orchestrator-agent → specialist-agent-a → summarizer-agent
                   ↘ specialist-agent-b ↗
```

When `specialist-agent-a` runs, `orchestrator-agent` is already in
`executionContext`. When `summarizer-agent` runs, both specialists are there.

Typical frameworks: **OpenAI Agents SDK** — you create the orchestrator agent
first and then attach child agents as handoff targets.

### Reverse traversal (`graph.reverseTraverse`)

Processes nodes from the terminals up to the root (upward BFS). Use this when
your framework requires **children to be defined first** so they can be
attached to their parent as tools or sub-graphs.

```
summarizer-agent → specialist-agent-a → orchestrator-agent
                 ↗ specialist-agent-b
```

When `specialist-agent-a` runs, `summarizer-agent` is already in
`executionContext`. When `orchestrator-agent` runs, both specialists are there.

Typical frameworks: **LangGraph** — you define leaf nodes first, then compose
them into parent nodes by attaching them as edges in the graph.

### Cyclic graphs

Both traversal methods are cycle-safe via a visited set. For `reverseTraverse`,
a graph with no terminal nodes (every node has at least one outgoing edge)
produces no iterations — there is no starting point for upward BFS.
`traverse` handles cycles normally; the cycle back-edge is simply skipped once
the target node has already been visited.

## Tracking

### Graph-level tracker

Call `graph.createTracker()` once per invocation. The tracker groups all
telemetry events (latency, tokens, success/failure) under a shared `runId`
that appears in LaunchDarkly's AI metrics.

```typescript
const tracker = graph.createTracker();
try {
  // ... execute graph ...
  tracker.trackInvocationSuccess();
} catch {
  tracker.trackInvocationFailure();
}
```

If you need to record tracking events across multiple requests (e.g. streaming),
use `tracker.resumptionToken` to serialize the tracker and reconstruct it later
via `aiClient.createGraphTracker(token, context)`.

### Node-level tracker

Each node also carries its own `LDAIConfigTracker` for recording metrics
against the underlying agent config (tokens, latency, model usage). Access it
inside your traversal callback via `node.getConfig().createTracker?.()`.

```typescript
graph.traverse((node, executionContext) => {
  const nodeTracker = node.getConfig().createTracker?.();
  // ... invoke the node's agent ...
  nodeTracker?.trackSuccess({ totalTokens: 120, inputTokens: 80, outputTokens: 40 });
  return result;
});
```
