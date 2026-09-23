# LaunchDarkly EventSource for JavaScript SDKs

[![NPM][eventsource-npm-badge]][eventsource-npm-link]
[![Actions Status][eventsource-ci-badge]][eventsource-ci]
[![Documentation][eventsource-ghp-badge]][eventsource-ghp-link]
[![NPM][eventsource-dm-badge]][eventsource-npm-link]
[![NPM][eventsource-dt-badge]][eventsource-npm-link]

> [!CAUTION]
> This package is in pre-release and not subject to backwards compatibility
> guarantees. The API may change based on feedback.
>
> Pin to a specific minor version and review the [changelog](CHANGELOG.md) before upgrading.

This package contains a W3C-compliant EventSource (server-sent events) client built on `fetch()`,
`ReadableStream` and `AbortController`.

This package is intended to be used by LaunchDarkly SDKs and not as a general EventSource implementation.

This package is derived from the [`eventsource`](https://www.npmjs.com/package/eventsource) npm
package. See [LICENSE](LICENSE) for the original license terms.

## Options reference

This section documents the behavior of `createEventSource`'s second argument for maintainers of this
package and its consumers. The authoritative definitions, including any behavior not covered here,
are the TSDoc comments on `EventSourceInitDict` in
`src/types.ts`.

### Events

Listeners attach in two ways:

- The `onopen`, `onerror`, `onretrying`, and `onclose` members are plain writable slots, one
  listener each. Assigning a slot never affects listeners registered through `addEventListener`.
  For one dispatched event, the matching slot runs first, then the `addEventListener` listeners.
  `onclose` is an exception: it is invoked only by the public `close()` method, never as part of
  event dispatch.
- `addEventListener(type, listener)` and `removeEventListener(type, listener)` register and
  remove any number of listeners per event type, including the SSE event types a server names
  through the `event:` field.

Listeners are typed by event type: for the event types this implementation itself dispatches, the
payload type comes from the exported `EventSourceEventMap`; a server-named SSE event carries a
`MessageEvent`.

Beyond the standard `open`/`message`/`error` events, this implementation dispatches:

- `closed`: the stream has been permanently closed, either by a non-retryable error or by calling
  `close()`. When `close()` closes the stream, the `onclose` slot is invoked at the same point,
  before the `closed` listeners; a non-retryable error dispatches `closed` without invoking
  `onclose`.
- `end`: the server ended the stream cleanly, with a complete response body. Not reported as an
  `error`, but still passed to `errorFilter` for retry purposes. A mid-stream connection drop --
  a reset, or a socket that closes without completing the response -- surfaces from the fetch
  transport as a read failure, so it dispatches `error` and invokes `onerror`. The original Node
  transport reported the incomplete-close case as `end`; a caller that treats `end` and `error`
  differently sees `error` more often here.
- `retrying`: after an error, indicates a reconnect is scheduled. The event's `delayMillis`
  property gives the delay.

The `open` event's `headers` property carries the HTTP response headers from the stream. The
`error` event carries `status`/`message` for HTTP errors. A server-sent SSE frame named `error`
also dispatches under the `error` type, with a `MessageEvent` payload; only that frame carries a
string `data` property.

An exception thrown by the `onopen`, `onerror`, or `onretrying` slot does not stop dispatch to
the `addEventListener` listeners for that event, and does not stop the stream's own reconnection
logic; the exception surfaces later, asynchronously, as an uncaught error.

### Retry delay: backoff and jitter

- `initialRetryDelayMillis` -- base delay before the first reconnect attempt (default 1000ms).
- `maxBackoffMillis` -- if set, the delay grows exponentially on each successive retry, up to this
  ceiling.
- `jitterRatio` -- if set, each computed delay is randomly reduced by up to this fraction.
- `retryResetIntervalMillis` -- how long the stream must have been healthy before the backoff
  counter resets to the initial delay.

### Error retry behavior

By default, connection failures and I/O errors are always retried; HTTP error responses are
retried only for 500, 502, 503, and 504. A 200 response that declares a Content-Type other than
`text/event-stream` is also treated as an error; it carries `status: 200` and goes through the
same filter (a response with no Content-Type header at all is accepted, so a minimal injected
transport can omit response headers). Set `errorFilter` to override this -- it receives the
error and returns `true` to retry or `false` to close the stream and raise `error`. There is no
guard against a filter that throws, matching the original package: the exception propagates into
the transport's callback, and the stream does not recover. Redirect handling is described in
[Redirects and bodies](#redirects-and-bodies) below.

### Headers, method, and body

`headers` sets additional request headers. Normally `Cache-Control: no-cache` and
`Accept: text/event-stream` are also sent; `skipDefaultHeaders: true` sends only the headers you
specify. `method` overrides the default `GET`; `body` sets a request body, for use with a
non-`GET` method.

### Read timeout

`readTimeoutMillis` drops and retries the connection if that many milliseconds elapse with no data
received, guarding against a TCP connection that fails without an I/O error.

### Listener registry

Listener storage and dispatch for `addEventListener` registrations go through a registry created
once per instance. The `createEventRegistry` option supplies the factory; when absent, the
instance uses the internal `Map`-backed registry, whose factory is also exported as
`createDefaultEventRegistry`. A substitute must satisfy the exported `EventListenerRegistry`
interface -- for example, an SDK can supply one backed by Node's `EventEmitter`. The registry
never sees the `on*` slots; they are plain members of the instance. The registry is trusted code:
it observes every event the instance dispatches and controls what its listeners actually receive.

### Credentials

`withCredentials: true` maps to `fetch()`'s `credentials: 'include'`, so a cross-origin stream is
opened with cookies and HTTP authentication.

### Dynamic URLs

`urlBuilder` returns the URL to use for the next connection attempt and is called immediately
before every request, including the first. This is how a query parameter that changes between
attempts stays current across reconnects.

### Injectable transport

The `fetch` option supplies the transport used to open the stream. When absent, the client uses
the global `fetch`. The option only requires the structural subset of the fetch API that the
client uses (see `FetchFn` in `src/types.ts`), so a real `fetch` implementation satisfies it
without casts. This is how the Node-based SDKs connect this client to `node:http`/`node:https`
with their agent, proxy, and TLS configuration: the client itself knows nothing about any of
those.

## Contributing

See [Contributing](../CONTRIBUTING.md).

## Verifying SDK build provenance with the SLSA framework

LaunchDarkly uses the [SLSA framework](https://slsa.dev/spec/v1.0/about) (Supply-chain Levels for Software Artifacts) to help developers make their supply chain more secure by ensuring the authenticity and build integrity of our published SDK packages. To learn more, see the [provenance guide](PROVENANCE.md).

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the 'gold' plan get access to more features than users in the 'silver' plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Read [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[eventsource-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/eventsource.yml/badge.svg
[eventsource-ci]: https://github.com/launchdarkly/js-core/actions/workflows/eventsource.yml
[eventsource-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/eventsource.svg?style=flat-square
[eventsource-npm-link]: https://www.npmjs.com/package/@launchdarkly/eventsource
[eventsource-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[eventsource-ghp-link]: https://launchdarkly.github.io/js-core/packages/shared/eventsource/docs/
[eventsource-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/eventsource.svg?style=flat-square
[eventsource-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/eventsource.svg?style=flat-square
