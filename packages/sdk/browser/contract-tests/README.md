# Browser SDK Contract Tests

This directory contains the contract test implementation for the LaunchDarkly Browser SDK using the [SDK Test Harness](https://github.com/launchdarkly/sdk-test-harness).

## Architecture

The browser contract tests consist of three components:

1. **Adapter** (`adapter/`): A Node.js server that:
   - Exposes a REST API on port 8000 for the test harness
   - Runs a WebSocket server on port 8001 for browser communication
   - Translates REST commands to WebSocket messages

2. **Entity** (`entity/`): A browser application (Vite app) that:
   - Connects to the adapter via WebSocket
   - Implements the actual SDK test logic
   - Runs the Browser SDK in a real browser environment

3. **Test Harness**: The SDK test harness that:
   - Sends test commands via REST API to the adapter (port 8000)
   - Validates SDK behavior across different scenarios

## Running Locally

### Prerequisites

- Node.js 18 or later
- Yarn
- A modern browser (for manual testing)

### Quick Start

```bash
# From the repository root
./packages/sdk/browser/contract-tests/run-test-service.sh
```

This script will:
1. Start the adapter (WebSocket bridge)
2. Start the entity (browser app with Vite dev server)
3. Open the browser app in your default browser

The services will be available at:
- Adapter REST API: http://localhost:8000
- Adapter WebSocket: ws://localhost:8001
- Browser App: http://localhost:5173

You then run the `sdk-test-harness`. More information is available here: https://github.com/launchdarkly/sdk-test-harness

Example with local clone of the test harness:
```bash
go run . --url http://localhost:8000 -skip-from path-to-your-js-core-clone/packages/sdk/browser/contract-tests/suppressions.txt
```
