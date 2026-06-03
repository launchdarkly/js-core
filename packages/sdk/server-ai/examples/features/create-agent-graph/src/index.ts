import 'dotenv/config';

import { init, type LDContext } from '@launchdarkly/node-server-sdk';
import { Observability } from '@launchdarkly/observability-node';
import { initAi } from '@launchdarkly/server-sdk-ai';
import type { AgentGraphNode } from '@launchdarkly/server-sdk-ai';

// Set sdkKey to your LaunchDarkly SDK key.
const sdkKey = process.env.LAUNCHDARKLY_SDK_KEY;

// Set graphKey to the Agent Graph key you want to evaluate.
const graphKey = process.env.LAUNCHDARKLY_AGENT_GRAPH_KEY || 'sample-agent-graph';

if (!sdkKey) {
  console.error('*** Please set the LAUNCHDARKLY_SDK_KEY env first');
  process.exit(1);
}

const ldClient = init(sdkKey, {
  plugins: [new Observability({ serviceName: 'js-server-ai-example-create-agent-graph' })],
});

// Set up the evaluation context. This context should appear on your
// LaunchDarkly contexts dashboard soon after you run the demo.
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
// ---------------------------------------------------------------------------
function forwardTraversalExample(graph: ReturnType<typeof Object.create>): void {
  console.log('\n--- Forward traversal (root → terminals) ---');

  graph.traverse((node: AgentGraphNode, executionContext: Record<string, unknown>) => {
    const agent = buildAgent(node);

    const childKeys = node.getEdges().map((e) => e.key);
    const ready = childKeys.filter((k) => executionContext[k]);
    console.log(
      `  built ${agent}  children: [${childKeys.join(', ') || 'none'}]  pre-built: [${ready.join(', ') || 'none'}]`,
    );

    return agent;
  });
}

// ---------------------------------------------------------------------------
// Reverse traversal — use when your framework builds children before parents.
// ---------------------------------------------------------------------------
function reverseTraversalExample(graph: ReturnType<typeof Object.create>): void {
  console.log('\n--- Reverse traversal (terminals → root) ---');

  graph.reverseTraverse((node: AgentGraphNode, executionContext: Record<string, unknown>) => {
    const agent = buildAgent(node);

    const childKeys = node.getEdges().map((e) => e.key);
    const builtChildren = childKeys.map((k) => executionContext[k]).filter(Boolean);
    console.log(`  built ${agent}  attaching children: [${builtChildren.join(', ') || 'none'}]`);

    return agent;
  });
}

async function main() {
  try {
    await ldClient.waitForInitialization({ timeout: 10 });
    console.log('*** SDK successfully initialized');
  } catch (error) {
    console.log(
      `*** SDK failed to initialize. Please check your internet connection and SDK credential for any typo: ${error}`,
    );
    process.exit(1);
  }

  const aiClient = initAi(ldClient);

  try {
    const graph = await aiClient.agentGraph(graphKey, context);

    if (!graph.enabled) {
      console.log(
        `AI config '${graphKey}' is disabled. Verify the config key exists in your LaunchDarkly project and is not targeting a disabled variation.`,
      );
      return;
    }

    console.log(`\n=== Graph: ${graphKey} ===`);
    console.log(`Root : ${graph.rootNode().getKey()}`);
    console.log(
      `Terminals: ${
        graph
          .terminalNodes()
          .map((n: AgentGraphNode) => n.getKey())
          .join(', ') || '(none — cyclic graph)'
      }`,
    );

    forwardTraversalExample(graph);
    reverseTraversalExample(graph);

    // Create a tracker to record this graph invocation in LaunchDarkly.
    // Call trackInvocationSuccess() or trackInvocationFailure() when done.
    const tracker = graph.createTracker();
    tracker.trackInvocationSuccess();
  } catch (err) {
    // In production, sanitize before logging — provider errors may include credentials.
    console.error('Error:', err);
  } finally {
    // Flush pending events and close the client.
    await ldClient.flush();
    ldClient.close();
  }
}

main();
