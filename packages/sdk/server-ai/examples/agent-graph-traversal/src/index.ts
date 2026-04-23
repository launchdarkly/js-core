/* eslint-disable no-console */
import { init, type LDContext } from '@launchdarkly/node-server-sdk';
import type { AgentGraphNode } from '@launchdarkly/server-sdk-ai';
import { initAi } from '@launchdarkly/server-sdk-ai';

const GRAPH_KEY = process.env.LAUNCHDARKLY_GRAPH_KEY || 'sample-graph';

const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;
if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

const ldClient = init(sdkKey);

const context: LDContext = {
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Build a provider-specific agent for this node.
// In a real implementation you would use node.getConfig() to read the agent's
// instructions/model and wire them into your framework (e.g. OpenAI Agents SDK,
// LangGraph, CrewAI).
function buildAgent(node: AgentGraphNode): string {
  return `<agent:${node.getKey()}>`;
}

// ---------------------------------------------------------------------------
// Forward traversal — use when your framework builds parents before children.
//
// Each node receives the agents built by its ancestors via executionContext,
// so a parent can be passed to its children as a handoff target.
//
// Example frameworks: OpenAI Agents SDK (register tools/handoffs on the
// parent, then attach child agents).
// ---------------------------------------------------------------------------
function forwardTraversalExample(graph: ReturnType<typeof Object.create>): void {
  console.log('\n--- Forward traversal (root → terminals) ---');

  graph.traverse((node: AgentGraphNode, executionContext: Record<string, unknown>) => {
    const agent = buildAgent(node);

    // Edges leaving this node tell you which agents this one can hand off to.
    // Those child agents will be built in subsequent iterations and available
    // in executionContext by the time they run.
    const childKeys = node.getEdges().map((e) => e.key);
    const ready = childKeys.filter((k) => executionContext[k]);
    console.log(
      `  built ${agent}  children: [${childKeys.join(', ') || 'none'}]  pre-built: [${ready.join(', ') || 'none'}]`,
    );

    // Store the built agent so descendants can reference it.
    return agent;
  });
}

// ---------------------------------------------------------------------------
// Reverse traversal — use when your framework builds children before parents.
//
// Each node receives already-built descendant agents via executionContext,
// so a child can be attached to its parent as a tool or sub-agent.
//
// Example frameworks: LangGraph (define leaf nodes first, then compose them
// into parent nodes as edges in the graph).
// ---------------------------------------------------------------------------
function reverseTraversalExample(graph: ReturnType<typeof Object.create>): void {
  console.log('\n--- Reverse traversal (terminals → root) ---');

  graph.reverseTraverse((node: AgentGraphNode, executionContext: Record<string, unknown>) => {
    const agent = buildAgent(node);

    // Children of this node are guaranteed to already be in executionContext.
    const childKeys = node.getEdges().map((e) => e.key);
    const builtChildren = childKeys.map((k) => executionContext[k]).filter(Boolean);
    console.log(`  built ${agent}  attaching children: [${builtChildren.join(', ') || 'none'}]`);

    return agent;
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  try {
    await ldClient.waitForInitialization({ timeout: 10 });
    console.log('*** SDK successfully initialized');
  } catch (error) {
    console.log(`*** SDK failed to initialize: ${error}`);
    process.exit(1);
  }

  const aiClient = initAi(ldClient);

  const graph = await aiClient.agentGraph(GRAPH_KEY, context);

  if (!graph.enabled) {
    console.log(`\n*** Graph "${GRAPH_KEY}" is not enabled or could not be fetched.`);
    process.exit(0);
  }

  console.log(`\n=== Graph: ${GRAPH_KEY} ===`);
  console.log(`Root : ${graph.rootNode().getKey()}`);
  console.log(
    `Terminals: ${
      graph
        .terminalNodes()
        .map((n) => n.getKey())
        .join(', ') || '(none — cyclic graph)'
    }`,
  );

  forwardTraversalExample(graph);
  reverseTraversalExample(graph);

  // Create a tracker to record this graph invocation in LaunchDarkly.
  // Call trackInvocationSuccess() or trackInvocationFailure() when done.
  const tracker = graph.createTracker();
  tracker.trackInvocationSuccess();

  await ldClient.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
