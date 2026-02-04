# React SDK contract-tests

This directory contains the contract test implementation for the LaunchDarkly React SDK using the [SDK Test Harness](https://github.com/launchdarkly/sdk-test-harness).

## Architecture
> NOTE: much of the test architecture is based off of
> [browser contract test](../../browser/contract-tests).

This contract test consists of 3 components:

1. [Adapter](../../browser/contract-tests/adapter/): A Node.js server that:
   - Exposes a REST API on port 8000 for the test harness
   - Runs a WebSocket server on port 8001 for browser communication
   - Translates REST commands to WebSocket messages

2. Entity: A browser application (NextJS app) that:
   - Connects to the adapter via WebSocket
   - Implements the actual SDK test logic
   - Runs the React SDK in a real browser environment

3. [Test harness](https://github.com/launchdarkly/sdk-test-harness): The SDK test harness that:
   - Sends test commands via REST API to the adapter (port 8000)
   - Validates SDK behavior across different scenarios

## Running Locally

### Prerequisites

- Node.js 18 or later
- Yarn
- A modern browser (for manual testing)

### Quick Start

```bash
# Install the workspace if you haven't already
yarn install

# Build contract tests and browser contract test (dependency)
yarn workspaces foreach -pR --topological-dev --from 'browser-contract-test-adapter' run build
yarn workspaces foreach -pR --topological-dev --from '@launchdarkly/react-sdk-contract-tests' run build
```

From the repository root
```bash
./packages/sdk/react/contract-tests/run-test-service.sh
```

This script will:
1. Start the adapter (WebSocket bridge)
2. Start the app

The services will be available at:
- Adapter REST API: http://localhost:8000
- Adapter WebSocket: ws://localhost:8001
- Browser App: http://localhost:8002

You then run the `sdk-test-harness`. More information is available here: https://github.com/launchdarkly/sdk-test-harness

