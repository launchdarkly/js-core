# Node Client SDK Contract Tests

This directory contains the contract test implementation for the LaunchDarkly Client-Side SDK for Node.js using the [SDK Test Harness](https://github.com/launchdarkly/sdk-test-harness).

The contract test service is an Express server that exposes a REST API on port 8000. The test harness sends commands to this service, which creates and manages SDK client instances and executes flag evaluations, events, and other operations.

## Running locally

From the SDK package directory (`packages/sdk/node-client`):

```bash
yarn contract-tests
```

This builds the SDK and the contract-test service, starts the service in the background on port 8000, downloads the matching `sdk-test-harness` binary, and runs the harness against the service. The harness shuts the service down when it finishes via `-stop-service-at-end`.

To run the service on its own (e.g. when iterating against a local checkout of `sdk-test-harness`):

```bash
yarn contract-test-service
```

Then run the harness from your local clone in another terminal.

## Suppressions

Two suppression files cover tests that are not yet supported or are known to differ:

- `testharness-suppressions.txt` -- default
- `testharness-suppressions-fdv2.txt` -- when running the harness from the `feat/fdv2` branch

Override the suppressions file by setting the `SUPPRESSIONS` environment variable:

```bash
SUPPRESSIONS=./contract-tests/testharness-suppressions-fdv2.txt yarn contract-tests
```

## Other environment variables

- `TEST_HARNESS_PARAMS` -- extra params appended to the harness command line (e.g. `-run TestName`).
- `VERSION` -- the major version of `sdk-test-harness` to download. Defaults to `v2`.
