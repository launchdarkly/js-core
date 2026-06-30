# LaunchDarkly OpenFeature Provider for the Node.js Server-Side SDK

[![NPM][openfeature-node-server-npm-badge]][openfeature-node-server-npm-link]
[![Actions Status][openfeature-node-server-ci-badge]][openfeature-node-server-ci]
[![Documentation][openfeature-node-server-ghp-badge]][openfeature-node-server-ghp-link]
[![NPM][openfeature-node-server-dm-badge]][openfeature-node-server-npm-link]
[![NPM][openfeature-node-server-dt-badge]][openfeature-node-server-npm-link]

This package provides an [OpenFeature](https://openfeature.dev/) provider that wraps the [LaunchDarkly Server-Side SDK for Node.js](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/server-node).

This provider is designed primarily for use in multi-user systems such as web servers and applications. It is not intended for use in desktop and embedded systems applications.

## Supported Node versions

This version of the LaunchDarkly OpenFeature provider is compatible with Node.js versions 20 and above.

## Installation

```bash
npm install @openfeature/server-sdk @launchdarkly/node-server-sdk @launchdarkly/openfeature-node-server
```

## Usage

```typescript
import { OpenFeature, ProviderEvents } from '@openfeature/server-sdk';
import { LaunchDarklyProvider } from '@launchdarkly/openfeature-node-server';

// The optional third parameter controls how long to wait for initialization (default: 10 seconds).
const provider = new LaunchDarklyProvider('your-sdk-key', {/* LDOptions here */});

// setProviderAndWait throws if initialization fails; catch as needed.
await OpenFeature.setProviderAndWait(provider);

// Access the underlying LDClient directly if needed.
const ldClient = provider.getClient();

const client = OpenFeature.getClient();
const flagValue = await client.getBooleanValue('flag-key', false, {
  targetingKey: 'user-key',
});

// The provider emits ConfigurationChanged for each flag key that may have changed.
// Each event contains a single key in the flagsChanged array.
OpenFeature.addHandler(ProviderEvents.ConfigurationChanged, (eventDetails) => {
  console.log(`Changed: ${eventDetails.flagsChanged}`);
});

// Calling close() flushes SDK events - useful for short-lived processes.
await OpenFeature.close();
```

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

[openfeature-node-server-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/openfeature-node-server.yaml/badge.svg
[openfeature-node-server-ci]: https://github.com/launchdarkly/js-core/actions/workflows/openfeature-node-server.yaml
[openfeature-node-server-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/openfeature-node-server.svg?style=flat-square
[openfeature-node-server-npm-link]: https://www.npmjs.com/package/@launchdarkly/openfeature-node-server
[openfeature-node-server-ghp-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[openfeature-node-server-ghp-link]: https://launchdarkly.github.io/js-core/packages/sdk/openfeature-node-server/docs/
[openfeature-node-server-dm-badge]: https://img.shields.io/npm/dm/@launchdarkly/openfeature-node-server.svg?style=flat-square
[openfeature-node-server-dt-badge]: https://img.shields.io/npm/dt/@launchdarkly/openfeature-node-server.svg?style=flat-square
