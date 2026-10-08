# EventSource Contract Tests

This is a test service for the [`sse-contract-tests`](https://github.com/launchdarkly/sse-contract-tests)
harness. It exposes a small HTTP API that the harness drives to create, command, and tear down
instances of `@launchdarkly/eventsource`'s `EventSource` class.

This package is not published and is not part of the release pipeline. See the harness repository's
own README for the protocol this service implements; it shouldn't need updating here unless this
SSE client's supported capabilities change.

## Running locally

From the repository root:

```bash
yarn workspace @launchdarkly/eventsource run build
yarn workspace @launchdarkly/eventsource-contract-tests run build
yarn workspace @launchdarkly/eventsource-contract-tests run start
```

The service listens on `http://localhost:8000`. With it running, in another terminal:

```bash
curl -s https://raw.githubusercontent.com/launchdarkly/sse-contract-tests/main/downloader/run.sh \
  | VERSION=v2 PARAMS="-url http://localhost:8000 -debug -stop-service-at-end" sh
```
