# LaunchDarkly OpenFeature Provider for the Cloudflare Server-Side SDK

[![NPM][sdk-openfeature-cloudflare-server-npm-badge]][sdk-openfeature-cloudflare-server-npm-link]
[![Actions Status][sdk-openfeature-cloudflare-server-ci-badge]][sdk-openfeature-cloudflare-server-ci]
[![Documentation][sdk-openfeature-cloudflare-server-ghp-badge]][sdk-openfeature-cloudflare-server-ghp-link]
[![NPM][sdk-openfeature-cloudflare-server-dm-badge]][sdk-openfeature-cloudflare-server-npm-link]
[![NPM][sdk-openfeature-cloudflare-server-dt-badge]][sdk-openfeature-cloudflare-server-npm-link]

> [!CAUTION]
> This provider is in pre-release and not subject to backwards compatibility
> guarantees. The API may change based on feedback.
>
> Pin to a specific minor version and review the [changelog](CHANGELOG.md) before upgrading.

This package provides an [OpenFeature](https://openfeature.dev/) provider that wraps the [LaunchDarkly Cloudflare SDK](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/cloudflare).

This provider is designed primarily for use in multi-user Cloudflare Workers. It follows the server-side LaunchDarkly model for multi-user contexts. It is not intended for use in desktop and embedded systems applications.

## Feature matrix

This matrix mirrors the [feature matrix of the OpenFeature SDK for JavaScript](https://github.com/open-feature/js-sdk/blob/main/packages/server/README.md#-features) and describes what this provider supports. Rows which are not supported state whether the limitation comes from the OpenFeature JavaScript SDK or from the provider.

| Status | Feature                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅     | Providers                       | Evaluates boolean, string, number, and object flags through the LaunchDarkly Cloudflare SDK.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ✅     | Targeting                       | The `EvaluationContext` is converted to a LaunchDarkly single or multi-context. See [OpenFeature Specific Considerations](#openfeature-specific-considerations).                                                                                                                                                                                                                                                                                                                                                              |
| ✅     | Hooks                           | Hooks are registered on the OpenFeature API and client; the provider requires no additional support and its results are visible to hooks, including [flag metadata](#flag-metadata).                                                                                                                                                                                                                                                                                                                                          |
| ✅     | Logging                         | The provider logs through the logging configuration of the `LDOptions` it is given.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ✅     | Domains                         | Domains bind clients to providers in the OpenFeature SDK; a separate provider instance may be registered per domain.                                                                                                                                                                                                                                                                                                                                                                                                          |
| ❌     | Eventing                        | This provider does not emit `ConfigurationChanged`, `Error`, or `Stale` events because the Cloudflare SDK reads flag data from a KV namespace on each evaluation and has no connection to LaunchDarkly to provide an underlying event to translate. This is a Cloudflare platform limitation, not an OpenFeature SDK or provider gap. See [ConfigurationChanged is not supported on this platform](#configurationchanged-is-not-supported-on-this-platform) and [#1886](https://github.com/launchdarkly/js-core/issues/1886). |
| ✅     | Transaction Context Propagation | Provided by the OpenFeature SDK, which merges the transaction context into the evaluation context before the provider is called; no provider support is required.                                                                                                                                                                                                                                                                                                                                                             |
| ✅     | Tracking                        | The common provider implementation translates tracking details and sends them through the Cloudflare LaunchDarkly client.                                                                                                                                                                                                                                                                                                                                                                                                     |
| ✅     | Initialization                  | `initialize` waits for the Cloudflare LaunchDarkly client with the common provider's default 10-second timeout; the Cloudflare provider passes no initialization-timeout override.                                                                                                                                                                                                                                                                                                                                            |
| ✅     | Shutdown                        | The common provider implementation flushes and closes the Cloudflare LaunchDarkly client. A closed client cannot be restarted, so a new provider instance is required afterward.                                                                                                                                                                                                                                                                                                                                              |
| ✅     | Extending                       | The underlying LaunchDarkly client is available through `getClient()` for functionality with no OpenFeature equivalent.                                                                                                                                                                                                                                                                                                                                                                                                       |
| ✅     | Multi-Provider                  | Provided by the OpenFeature SDK; no provider support is required.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ✅     | Flag metadata                   | LaunchDarkly evaluation reason details are returned as OpenFeature flag metadata. See [Flag Metadata](#flag-metadata).                                                                                                                                                                                                                                                                                                                                                                                                        |

<sub>Supported: ✅ | Partially supported: ⚠️ | Not supported: ❌</sub>

## Installation

```bash
npm install @openfeature/server-sdk @launchdarkly/cloudflare-server-sdk @launchdarkly/openfeature-cloudflare-server
```

Then turn on the Node.js compatibility flag in your `wrangler.toml`. This allows the underlying Cloudflare SDK to use `node:events`:

```toml
compatibility_flags = [ "nodejs_compat" ]
```

## Usage

`OpenFeature.setProviderAndWait` registers the provider on a registry shared by every
concurrent request in the Workers isolate. Calling it on every request races concurrent
requests against that shared state. Initialize the provider once per isolate and reuse it
for every subsequent request, matching the [Cloudflare SDK's own
guidance](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/cloudflare#usage)
that applications should instantiate a single instance for the lifetime of the worker:

```typescript
import { OpenFeature } from '@openfeature/server-sdk';
import { LaunchDarklyProvider } from '@launchdarkly/openfeature-cloudflare-server';

const clientSideID = 'your-client-side-id';

let provider: LaunchDarklyProvider | undefined;
let providerReady: Promise<unknown> | undefined;

function ensureProviderReady(env: Bindings): Promise<unknown> {
  if (!providerReady) {
    // env.LD_KV is the Cloudflare KV namespace binding configured for LaunchDarkly.
    // See https://developers.cloudflare.com/workers/runtime-apis/kv#kv-bindings
    provider = new LaunchDarklyProvider(clientSideID, env.LD_KV /*, LDOptions here */);
    providerReady = OpenFeature.setProviderAndWait(provider);
  }
  return providerReady;
}

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    // setProviderAndWait throws if initialization fails; catch as needed.
    await ensureProviderReady(env);

    const client = OpenFeature.getClient();
    const flagValue = await client.getBooleanValue('flag-key', false, {
      targetingKey: 'user-key',
    });

    // Flushing (not closing) is safe to call per request -- it only sends this
    // request's queued events and never tears down the shared provider/client.
    ctx.waitUntil(provider!.getClient().flush());

    return new Response(`flag-key: ${flagValue}`);
  },
};
```

See the full [getting-started example](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/openfeature-cloudflare-server/examples/getting-started).

## ConfigurationChanged is not supported on this platform

Unlike the [LaunchDarkly OpenFeature provider for Node.js](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/openfeature-node-server), this provider does not emit the OpenFeature `ConfigurationChanged` event.

The Cloudflare SDK reads flag data out of a Cloudflare KV namespace via its `EdgeFeatureStore` on each evaluation; that store's `upsert` and `delete` methods -- which a streaming, long-lived SDK client would use to react to flag changes -- are hardcoded no-ops on this platform. There is no persistent connection to LaunchDarkly and no local cache that receives update notifications, so there is no underlying event for the provider to translate into `ConfigurationChanged`. Because Cloudflare Workers are short-lived and re-read the latest flag data from KV on every request, you do not need a change notification to see up-to-date flag values -- simply re-evaluate the flag on the next request.

## OpenFeature Specific Considerations

LaunchDarkly evaluates contexts, and it can either evaluate a single-context or a multi-context. When using OpenFeature, both single and multi-contexts must be encoded into a single `EvaluationContext`. This is accomplished by looking for an attribute named `kind` in the `EvaluationContext`.

There are 4 different scenarios related to the `kind`:

1. There is no `kind` attribute. The provider will treat the context as a single context of kind `"user"`.
2. There is a `kind` attribute with the value `"multi"`. The provider will treat the context as a multi-context.
3. There is a `kind` attribute with a string value other than `"multi"`. The provider will treat it as a single context of the specified kind.
4. There is a `kind` attribute, but its value is not a string. The value will be discarded, the context will be treated as kind `"user"`, and a warning will be logged.

The `kind` attribute should be a string containing only ASCII letters, numbers, `.`, `_`, or `-`.

The OpenFeature specification allows for an optional targeting key, but LaunchDarkly requires a key for evaluation. A targeting key must be specified for each context being evaluated. It may be specified using either `targetingKey`, as defined in the OpenFeature specification, or `key`, which is the typical LaunchDarkly identifier. If both are specified, `targetingKey` takes precedence.

There are several attributes with special handling within a single or multi-context:

- `privateAttributes` - Must be an array of strings. Equivalent to `_meta.privateAttributes` in the SDK.
- `anonymous` - Must be a boolean. Equivalent to `anonymous` in the SDK.
- `name` - Must be a string. Equivalent to `name` in the SDK.

### Examples

#### A single user context

```typescript
const evaluationContext = {
  targetingKey: 'my-user-key',
};
```

#### A single context of kind "organization"

```typescript
const evaluationContext = {
  kind: 'organization',
  targetingKey: 'my-org-key',
};
```

#### A multi-context containing a "user" and an "organization"

```typescript
const evaluationContext = {
  kind: 'multi',
  organization: {
    targetingKey: 'my-org-key',
    myCustomAttribute: 'myAttributeValue',
  },
  user: {
    targetingKey: 'my-user-key',
  },
};
```

#### Setting private attributes in a single context

```typescript
const evaluationContext = {
  kind: 'organization',
  name: 'the-org-name',
  targetingKey: 'my-org-key',
  myCustomAttribute: 'myCustomValue',
  privateAttributes: ['myCustomAttribute'],
};
```

#### Setting private attributes in a multi-context

```typescript
const evaluationContext = {
  kind: 'multi',
  organization: {
    targetingKey: 'my-org-key',
    name: 'the-org-name',
    // privateAttributes only applies to the "organization" context.
    privateAttributes: ['myCustomAttribute'],
    // This attribute will be private.
    myCustomAttribute: 'myAttributeValue',
  },
  user: {
    targetingKey: 'my-user-key',
    anonymous: true,
    // This attribute will not be private.
    myCustomAttribute: 'myAttributeValue',
  },
};
```

## Contributing

See [Contributing](../../../CONTRIBUTING.md).

## Verifying SDK build provenance with the SLSA framework

LaunchDarkly uses the [SLSA framework](https://slsa.dev/spec/v1.0/about) (Supply-chain Levels for Software Artifacts) to help developers make their supply chain more secure by ensuring the authenticity and build integrity of our published SDK packages. To learn more, see the [provenance guide](PROVENANCE.md).

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the 'gold' plan get access to more features than users in the 'silver' plan).
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[sdk-openfeature-cloudflare-server-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/openfeature-cloudflare-server.yaml/badge.svg
[sdk-openfeature-cloudflare-server-ci]: https://github.com/launchdarkly/js-core/actions/workflows/openfeature-cloudflare-server.yaml
[sdk-openfeature-cloudflare-server-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/openfeature-cloudflare-server.svg?style=flat-square
[sdk-openfeature-cloudflare-server-npm-link]: https://www.npmjs.com/package/@launchdarkly/openfeature-cloudflare-server
[sdk-openfeature-cloudflare-server-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[sdk-openfeature-cloudflare-server-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/openfeature-cloudflare-server/docs/
[sdk-openfeature-cloudflare-server-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/openfeature-cloudflare-server.svg?style=flat-square
[sdk-openfeature-cloudflare-server-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/openfeature-cloudflare-server.svg?style=flat-square
