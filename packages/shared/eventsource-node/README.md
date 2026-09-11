# LaunchDarkly EventSource for Node

[![NPM][eventsource-node-npm-badge]][eventsource-node-npm-link]
[![Actions Status][eventsource-node-ci-badge]][eventsource-node-ci]
[![Documentation][eventsource-node-ghp-badge]][eventsource-node-ghp-link]
[![NPM][eventsource-node-dm-badge]][eventsource-node-npm-link]
[![NPM][eventsource-node-dt-badge]][eventsource-node-npm-link]

> [!CAUTION]
> This package is in pre-release and not subject to backwards compatibility
> guarantees. The API may change based on feedback.
>
> Pin to a specific minor version and review the [changelog](CHANGELOG.md) before upgrading.

This package contains a W3C-compliant EventSource (server-sent events) client for Node, using
`http`/`https`. It is used for streaming connections by the LaunchDarkly SDKs.

This package is not intended to be used directly.

This package is derived from the
[`launchdarkly-eventsource`](https://www.npmjs.com/package/launchdarkly-eventsource) npm package
([launchdarkly/js-eventsource](https://github.com/launchdarkly/js-eventsource)), itself a fork of
the [`eventsource`](https://www.npmjs.com/package/eventsource) npm package. See
[LICENSE](LICENSE) for the original license terms.

## Options reference

This section documents the behavior of the constructor's second argument for maintainers of this
package and its consumers. The authoritative definitions, including any behavior not covered here,
are the TSDoc comments on `EventSourceInitDict` and `NodeEventSourceInitDict` in `src/types.ts`.

### Events

Beyond the standard `open`/`message`/`error` events, this implementation emits:

- `closed`: the stream has been permanently closed, either by a non-retryable error or by calling
  `close()`.
- `end`: the server ended the stream. Not reported as an `error`, but still treated as one for
  retry purposes.
- `retrying`: after an error, indicates a reconnect is scheduled. The event's `delayMillis`
  property gives the delay.

The `open` event's `headers` property carries the HTTP response headers from the stream. The
`error` event carries `status`/`message` for HTTP errors.

### Retry delay: backoff and jitter

- `initialRetryDelayMillis` -- base delay before the first reconnect attempt (default 1000ms).
- `maxBackoffMillis` -- if set, the delay grows exponentially on each successive retry, up to this
  ceiling.
- `jitterRatio` -- if set, each computed delay is randomly reduced by up to this fraction.
- `retryResetIntervalMillis` -- how long the stream must have been healthy before the backoff
  counter resets to the initial delay.

### Error retry behavior

By default, connection failures and I/O errors are always retried; HTTP error responses are
retried only for 500, 502, 503, and 504. Set `errorFilter` to override this -- it receives the
error and returns `true` to retry or `false` to close the stream and raise `error`. There is no
guard against a filter that throws, matching the original package: the exception propagates into
the transport's callback, and the stream does not recover. Redirects (301/307) with a present
`Location` header are never treated as errors; they are always followed by hand. Any other
redirect status (302, 303, 308) is reported as a non-200 HTTP error, subject to the default
`errorFilter`.

### Headers, method, and body

`headers` sets additional request headers. Normally `Cache-Control: no-cache` and
`Accept: text/event-stream` are also sent; `skipDefaultHeaders: true` sends only the headers you
specify. `method` overrides the default `GET`; `body` sets a request body, for use with a
non-`GET` method.

### Read timeout

`readTimeoutMillis` drops and retries the connection if that many milliseconds elapse with no data
received, guarding against a TCP connection that fails without an I/O error.

### TLS (`https`)

`https` accepts the options recognized by Node's `tls.connect()`/`tls.createSecureContext()`
(`EventSourceHttpsOptions` in `src/types.ts`: `pfx`, `key`, `passphrase`, `cert`, `ca`, `ciphers`,
`rejectUnauthorized`, `secureProtocol`, `servername`, `checkServerIdentity`). Certificate
validation follows Node's own default (`rejectUnauthorized: true`); `https.rejectUnauthorized`
is the only way to change it. The original package instead disabled validation unless the caller
opted in through a top-level `rejectUnauthorized` legacy alias -- this port removes both the
alias and that default. The three SDK consumers pass their `tlsParams` configuration through as
this option.

### Proxy and agent

`proxy` sends the request through the given HTTP/HTTPS proxy URL. `agent` supplies a Node
`http`/`https` agent directly, which is also how a tunneling agent would be configured for
proxying.

### Feature detection

`EventSource.supportedOptions` is an object with a `true` value for each option name this
implementation recognizes, for callers that may be running against a different EventSource
implementation and want to check support before using a non-W3C-standard option. Note that the
list is not exhaustive: `body` and `readTimeoutMillis` are real, documented options that are
absent from the `supportedOptions`/`SupportedOptionName` lists, as is `agent`. `urlBuilder`,
which the platform `EventSourceInitDict` declares, is not supported by this package at all.

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

[eventsource-node-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/eventsource-node.yml/badge.svg
[eventsource-node-ci]: https://github.com/launchdarkly/js-core/actions/workflows/eventsource-node.yml
[eventsource-node-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/eventsource-node.svg?style=flat-square
[eventsource-node-npm-link]: https://www.npmjs.com/package/@launchdarkly/eventsource-node
[eventsource-node-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[eventsource-node-ghp-link]: https://launchdarkly.github.io/js-core/packages/shared/eventsource-node/docs/
[eventsource-node-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/eventsource-node.svg?style=flat-square
[eventsource-node-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/eventsource-node.svg?style=flat-square
