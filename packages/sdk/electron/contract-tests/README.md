# Electron SDK Contract Tests

This directory contains the contract test implementation for the LaunchDarkly Electron SDK using the [SDK Test Harness](https://github.com/launchdarkly/sdk-test-harness).

## Architecture

The Electron contract tests use a single component:

**Entity** (`entity/`): An Electron application that:

- Runs an Express server in the **main process** on port 8000
- Exposes a REST API that the test harness calls directly (no separate adapter)
- Creates and manages Electron SDK clients via `ClientFactory` in response to harness commands
- Implements the contract test protocol: create client (POST /), run commands (POST /clients/:id), delete client (DELETE /clients/:id), shutdown (DELETE /)

The test harness sends HTTP requests to the entity’s REST API. The entity runs the Electron SDK in the main process and responds with evaluation results and other command outputs.

## Running Locally

### Prerequisites

- Node.js 18 or later
- Yarn
- Electron-supported platform (macOS, Windows, or Linux). For headless/CI, a virtual display (e.g. xvfb on Linux) may be required.

### Quick start

1. **Install dependencies** from the repository root:
   ```bash
   yarn
   ```

2. **Build the entity** so the Electron app has a built main process. From the repository root:
   ```bash
   yarn workspaces foreach -pR --topological-dev --from @internal/electron-contract-tests-entity run build
   ```

3. **Start the contract test entity** (the Electron app with the REST server on port 8000). From the repository root:
   ```bash
   yarn workspace @internal/electron-contract-tests-entity run start
   ```
   Or from `entity/`:
   ```bash
   yarn start
   ```
   The app window may open; the server runs in the main process. Keep it running while you run the harness.

   For a headless run (e.g. CI), use the open-electron script instead:
   ```bash
   yarn workspace @internal/electron-contract-tests-entity run open-electron
   ```
   This launches the built app via Playwright’s Electron API and keeps it running until you press Ctrl+C.

4. **Run the SDK test harness** against the entity. The entity’s REST API is at:
   - **Base URL:** http://localhost:8000

   Example with a local clone of the test harness:
   ```bash
   go run . --url http://localhost:8000
   ```

   If you have a suppressions file (e.g. for known differences), pass it with `-skip-from`:
   ```bash
   go run . --url http://localhost:8000 -skip-from path-to-js-core/packages/sdk/electron/contract-tests/suppressions.txt
   ```

More details on the harness: https://github.com/launchdarkly/sdk-test-harness
