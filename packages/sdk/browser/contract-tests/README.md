# Browser SDK Contract Tests

This directory contains the contract test implementation for the LaunchDarkly Browser SDK using the [SDK Test Harness](https://github.com/launchdarkly/sdk-test-harness).

## Architecture

The browser contract tests consist of three components:

1. **Adapter**: The `npx sdk-testharness-server adapter` CLI from `@launchdarkly/js-contract-test-utils`. The adapter:
   - Runs a WebSocket server on port 8001 for browser communication
   - Translates REST commands to WebSocket messages
   - Exposes a REST API on port 8000 for the test harness. **Note:** the REST server (8000) is only started once a browser entity connects over the WebSocket (8001), and it is torn down and recreated on every (re)connection. A browser must therefore be connected before the harness can reach port 8000.

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
- Chromium for Playwright (used for headless runs). Install it once with:

  ```bash
  yarn workspace @launchdarkly/browser-contract-test-service run install-playwright-browsers
  ```

  If you later hit a Playwright error like `Executable doesn't exist at .../chrome-headless-shell-<version>`, the bundled Playwright was updated and now expects a newer Chromium build — just re-run the command above (or `npx playwright install chromium` from `entity/`).

### Quick Start (opens your default browser)

```bash
# From the repository root
./packages/sdk/browser/contract-tests/run-test-service.sh
```

This starts the adapter and the entity (Vite dev server) and opens the entity in your **default browser**.

The services will be available at:
- Adapter REST API: http://localhost:8000
- Adapter WebSocket: ws://localhost:8001
- Browser App: http://localhost:5173

> **Important:** the adapter's REST API (8000) only starts listening once a browser entity has connected over the WebSocket (8001) — see the Architecture note above. If `http://localhost:8000` is not responding, make sure a browser (a real tab, or the headless instance below) is loaded and connected.

### Headless (no GUI / CI)

For CI or a headless machine, start the pieces separately and drive the entity with a headless Chromium via Playwright. `open-browser.mjs` loads the entity, keeps it open, and streams the browser console (`[Browser Console]` / `[Browser Error]`) to stdout — handy for debugging the front-end:

```bash
# 1. Adapter (WebSocket bridge + REST)
yarn workspace @launchdarkly/browser-contract-test-service run start:adapter &

# 2. Entity Vite dev server, WITHOUT auto-opening a browser
yarn workspace @launchdarkly/browser-contract-test-service run start:headless &

# 3. Headless browser that loads the entity and connects to the adapter
node packages/sdk/browser/contract-tests/entity/open-browser.mjs http://localhost:5173 &
```

Once the headless browser connects, the adapter logs `Listening on port 8000` and the REST API becomes available.

### Running the test harness

Point the [sdk-test-harness](https://github.com/launchdarkly/sdk-test-harness) at the adapter's REST API (port **8000**), skipping the tests listed in one of the suppression files:

```bash
# from your local sdk-test-harness clone
go run . --url http://localhost:8000 \
  -skip-from path-to-your-js-core-clone/packages/sdk/browser/contract-tests/suppressions.txt
```

#### Suppression files

Two skip-lists live alongside this README; pass the appropriate one to `-skip-from`:

- **`suppressions.txt`** — the standard skip list for the Browser SDK contract tests.
- **`suppressions_datamode_changes.txt`** — a broader skip list used when running against the FDv2 (data system / "data mode") client-side work. In addition to the standard skips, it excludes request tests that are not expected to pass in that configuration yet (the HTTP `REPORT` streaming/polling request variants and the `tags` streaming/polling request tests), giving a clean baseline on that branch.
