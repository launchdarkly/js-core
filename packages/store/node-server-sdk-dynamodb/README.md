# LaunchDarkly Server-Side SDK for Node.js - DynamoDB integration

[![NPM][node-dynamodb-npm-badge]][node-dynamodb-npm-link]
[![Actions Status][node-dynamodb-ci-badge]][node-dynamodb-ci]
[![Documentation](https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8)](https://launchdarkly.github.io/js-core/packages/store/node-server-sdk-dynamodb/docs/)

This library provides a DynamoDB-backed persistence mechanism (feature store) for the [LaunchDarkly Node.js SDK](https://github.com/launchdarkly/js-core/packages/sdk/server-node), replacing the default in-memory feature store. It uses the AWS SDK for Node.js.
The minimum version of the LaunchDarkly Server-Side SDK for Node for use with this library is 8.0.0.

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Supported Node versions

This package is compatible with Node.js versions 14 and above.

## Getting started

Refer to [Using DynamoDB as a persistent feature store](https://docs.launchdarkly.com/sdk/features/storing-data/dynamodb#nodejs-server-side).

## Quick setup

1. In DynamoDB, create a table which has the following schema: a partition key called "namespace" and a sort key called "key", both with a string type. The LaunchDarkly library does not create the table automatically, because it has no way of knowing what additional properties (such as permissions and throughput) you would want it to have.

2. Install this package with `npm` or `yarn`:

`npm install @launchdarkly/node-server-sdk-dynamodb --save`

3. If your application does not already have its own dependency on the `@aws-sdk/client-dynamodb` package, and if it will _not_ be running in AWS Lambda, add `@aws-sdk/client-dynamodb` as well:

`npm install @aws-sdk/client-dynamodb --save`

The `launchdarkly-node-server-sdk-dynamodb` package does not provide `@aws-sdk/client-dynamodb` as a transitive dependency, because it is provided automatically by the Lambda runtime and this would unnecessarily increase the size of applications deployed in Lambda. Therefore, if you are not using Lambda you need to provide `@aws-sdk/client-dynamodb` separately.

4. Import the package:

```typescript
const { DynamoDBFeatureStore } = require('launchdarkly-node-server-sdk-dynamodb');
```

5. When configuring your SDK client, add the DynamoDB feature store:

```typescript
const store = DynamoDBFeatureStore('YOUR TABLE NAME');
const config = { featureStore: store };
const client = LaunchDarkly.init('YOUR SDK KEY', config);
```

By default, the DynamoDB client will try to get your AWS credentials and region name from environment variables and/or local configuration files, as described in the AWS SDK documentation. You can also specify any valid [DynamoDB client options](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#constructor-property) like this:

```typescript
const dynamoDBOptions = {
  credentials: { accessKeyId: 'YOUR KEY', secretAccessKey: 'YOUR SECRET' },
};
const store = DynamoDBFeatureStore('YOUR TABLE NAME', { clientOptions: dynamoDBOptions });
```

Alternatively, if you already have a fully configured DynamoDB client object, you can tell LaunchDarkly to use that:

```typescript
const store = DynamoDBFeatureStore('YOUR TABLE NAME', {
  dynamoDBClient: myDynamoDBClientInstance,
});
```

6. If you are running a [LaunchDarkly Relay Proxy](https://github.com/launchdarkly/ld-relay) instance, or any other process that will pre-populate the DynamoDB table with feature flags from LaunchDarkly, you can use [daemon mode](https://github.com/launchdarkly/ld-relay#daemon-mode), so that the SDK retrieves flag data only from DynamoDB and does not communicate directly with LaunchDarkly. This is controlled by the SDK's `useLdd` option:

```typescript
const config = { featureStore: store, useLdd: true };
const client = LaunchDarkly.init('YOUR SDK KEY', config);
```

7. If the same DynamoDB table is being shared by SDK clients for different LaunchDarkly environments, set the `prefix` option to a different short string for each one to keep the keys from colliding:

```typescript
const store = DynamoDBFeatureStore('YOUR TABLE NAME', { prefix: 'env1' });
```

## Caching behavior

To reduce traffic to DynamoDB, there is an optional in-memory cache that retains the last known data for a configurable amount of time. This is on by default; to turn it off (and guarantee that the latest feature flag data will always be retrieved from DynamoDB for every flag evaluation), configure the store as follows:

```typescript
const factory = DynamoDBFeatureStore({ cacheTTL: 0 });
```

## Contributing

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](CONTRIBUTING.md) for instructions on how to contribute to this SDK.

## About LaunchDarkly

- LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard. With LaunchDarkly, you can:
  - Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta tester group), gathering feedback and bug reports from real-world use cases.
  - Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
  - Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
  - Grant access to certain features based on user attributes, like payment plan (eg: users on the ‘gold’ plan get access to more features than users in the ‘silver’ plan). Disable parts of your application to facilitate maintenance, without taking everything offline.
- LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Check out [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
- Explore LaunchDarkly
  - [launchdarkly.com](https://www.launchdarkly.com/ 'LaunchDarkly Main Website') for more information
  - [docs.launchdarkly.com](https://docs.launchdarkly.com/ 'LaunchDarkly Documentation') for our documentation and SDK reference guides
  - [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/ 'LaunchDarkly API Documentation') for our API documentation
  - [blog.launchdarkly.com](https://blog.launchdarkly.com/ 'LaunchDarkly Blog Documentation') for the latest product updates

[node-dynamodb-ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/node-dynamodb.yml/badge.svg
[node-dynamodb-ci]: https://github.com/launchdarkly/js-core/actions/workflows/node-dynamodb.yml
[node-dynamodb-npm-badge]: https://img.shields.io/npm/v/@launchdarkly/node-server-sdk-dynamodb.svg?style=flat-square
[node-dynamodb-npm-link]: https://www.npmjs.com/package/@launchdarkly/node-server-sdk-dynamodb
