# LaunchDarkly Server-Side SDK for Node.js - Redis integration

[![NPM][node-redis-npm-badge]][node-redis-npm-link]
[![Actions Status][node-redis-ci-badge]][node-redis-ci]
[![Documentation](https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8)](https://launchdarkly.github.io/js-core/packages/store/node-server-sdk-redis/docs/)

This library provides a Redis-backed persistence mechanism (feature store) for the [LaunchDarkly Node.js SDK](https://github.com/launchdarkly/js-core/packages/sdk/server-node), replacing the default in-memory feature store. The underlying Redis client implementation is [ioredis](https://github.com/luin/ioredis).

The minimum version of the LaunchDarkly Server-Side SDK for Node for use with this library is 8.0.0.

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Supported Node versions

This package is compatible with Node.js versions 14 and above.

## Getting started

Refer to [Using Redis as a persistent feature store](https://docs.launchdarkly.com/sdk/features/storing-data/redis#nodejs-server-side).

## Quick setup

This assumes that you have already installed the LaunchDarkly Node.js SDK.

1. Install this package with `npm` or `yarn`:

```shell
npm install @launchdarkly/node-server-sdk-redis --save
```

2. If your application does not already have its own dependency on the `ioredis` package, add `ioredis` as well:

```shell
npm install ioredis --save
```

3. Import the package:

```typescript
import { RedisFeatureStore } = from '@launchdarkly/node-server-sdk-redis';
```

4. When configuring your SDK client, add the Redis feature store:

```typescript
const storeFactory = RedisFeatureStore();
const config = { featureStore: storeFactory };
const client = LaunchDarkly.init('YOUR SDK KEY', config);
```

By default, the store will try to connect to a local Redis instance on port 6379. You may specify an alternate configuration as described in the API documentation for `RedisFeatureStoreFactory`.

## Caching behavior

To reduce traffic to Redis, there is an optional in-memory cache that retains the last known data for a configurable amount of time. This is on by default; to turn it off (and guarantee that the latest feature flag data will always be retrieved from Redis for every flag evaluation), configure the store as follows:

```typescript
const factory = RedisFeatureStoreFactory({ cacheTTL: 0 });
```

## Contributing

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](CONTRIBUTING.md) for instructions on how to contribute to this SDK.

## Verifying SDK build provenance with the SLSA framework

LaunchDarkly uses the [SLSA framework](https://slsa.dev/spec/v1.0/about) (Supply-chain Levels for Software Artifacts) to help developers make their supply chain more secure by ensuring the authenticity and build integrity of our published SDK packages. To learn more, see the [provenance guide](PROVENANCE.md). 

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan). 
  - Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[node-redis-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/node-redis.yml/badge.svg
[node-redis-ci]: https://github.com/launchdarkly/js-core/actions/workflows/node-redis.yml
[node-redis-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/node-server-sdk-redis.svg?style=flat-square
[node-redis-npm-link]: https://www.npmjs.com/package/@launchdarkly/node-server-sdk-redis
