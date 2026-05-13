# Create Agent Graph Example

This example demonstrates how to use LaunchDarkly's `agentGraph` method to fetch a multi-node agent graph and wire it into an AI framework using either forward or reverse traversal.

## Prerequisites

- Node.js 20+
- A LaunchDarkly account and SDK key

## Setup

1. Create an Agent Graph in LaunchDarkly with the key `sample-agent-graph`. Define a root node and at least one downstream agent node.
2. Copy `.env.example` to `.env` and fill in your keys:
   ```
   cp .env.example .env
   ```
   Then edit `.env` to add your `LAUNCHDARKLY_SDK_KEY`.
3. From the repository root, install dependencies and build the SDK packages this example depends on:
   ```
   yarn install
   yarn workspace create-agent-graph bootstrap
   ```

## Run

```
yarn workspace create-agent-graph start
```

The example demonstrates both traversal directions:

- **Forward traversal** (`graph.traverse`) walks root → terminals (BFS). Use this when your framework expects a parent to be defined first so that child agents can be registered on it (e.g. OpenAI Agents SDK).
- **Reverse traversal** (`graph.reverseTraverse`) walks terminals → root. Use this when your framework expects children to be defined first so they can be attached to their parent as tools or sub-graphs (e.g. LangGraph).

Each callback receives an `executionContext` map where the previously processed nodes' return values are available by node key.
