# Node Server SDK Contract Tests

This directory contains the contract test implementation for the LaunchDarkly Node.js Server SDK using the [SDK Test Harness](https://github.com/launchdarkly/sdk-test-harness).

The contract test service is an Express server that exposes a REST API on port 8000. The test harness sends commands to this service, which creates and manages SDK client instances and executes flag evaluations, events, and other operations.

## Running Locally

From the repository root:

```bash
yarn workspace node-server-sdk-contract-tests run build
yarn workspace node-server-sdk-contract-tests run start
```

The service will listen on http://localhost:8000. You can then run the test harness from a separate terminal (see the [SDK Test Harness](https://github.com/launchdarkly/sdk-test-harness) repository for details).

Suppression files for tests that are not yet supported or are known to differ:

- `testharness-suppressions.txt` – used by the default contract test run
- `testharness-suppressions-fdv2.txt` – used when running the harness from the feat/fdv2 branch
