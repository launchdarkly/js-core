# LaunchDarkly Server-Side SDK for Node.js - MongoDB Support

[![NPM][npm-badge]][npm-url]
[![Actions Status][ci-badge]][ci-url]
[![Documentation][docs-badge]][docs-url]

This library provides a MongoDB-backed persistence mechanism (data store) for the [LaunchDarkly Server-Side SDK for Node.js](https://github.com/launchdarkly/js-core/packages/sdk/server-node), replacing the default in-memory data store. It includes both a **feature store** for storing feature flags and segments, and a **big segment store** for managing large user segments in MongoDB collections.

## LaunchDarkly overview

[LaunchDarkly](https://www.launchdarkly.com) is a feature management platform that serves over 100 billion feature flags daily to help teams build better software, faster. [Get started](https://docs.launchdarkly.com/home/getting-started) using LaunchDarkly today!

[![Twitter Follow](https://img.shields.io/twitter/follow/launchdarkly.svg?style=social&label=Follow&maxAge=2592000)](https://twitter.com/intent/follow?screen_name=launchdarkly)

## Supported Node versions

This package is compatible with Node.js versions 14 and above.

## Installation

```bash
npm install @launchdarkly/node-server-sdk-mongodb
```

## Quick setup

This assumes that you have already installed the LaunchDarkly Server-Side SDK for Node.js.

```javascript
const ld = require('@launchdarkly/node-server-sdk');
const { MongoDBFeatureStore, MongoDBBigSegmentStore } = require('@launchdarkly/node-server-sdk-mongodb');

const options = {
  // Use MongoDB for feature flags and segments
  featureStore: MongoDBFeatureStore({
    uri: 'mongodb://localhost:27017',
    database: 'launchdarkly',
    prefix: 'ld_'
  }),
  // Use MongoDB for big segments
  bigSegments: {
    store: MongoDBBigSegmentStore({
      uri: 'mongodb://localhost:27017',
      database: 'launchdarkly',
      prefix: 'ld_'
    })
  }
};

const client = ld.init('YOUR_SDK_KEY', options);
```

## TypeScript

```typescript
import { init } from '@launchdarkly/node-server-sdk';
import { MongoDBFeatureStore, MongoDBBigSegmentStore } from '@launchdarkly/node-server-sdk-mongodb';

const client = init('YOUR_SDK_KEY', {
  // Use MongoDB for feature flags and segments
  featureStore: MongoDBFeatureStore({
    uri: 'mongodb://localhost:27017',
    database: 'launchdarkly',
    prefix: 'ld_'
  }),
  // Use MongoDB for big segments
  bigSegments: {
    store: MongoDBBigSegmentStore({
      uri: 'mongodb://localhost:27017',
      database: 'launchdarkly',
      prefix: 'ld_'
    })
  }
});
```

## Configuration options

The MongoDB big segment store supports the following configuration options:

- `uri` (string): The MongoDB connection URI. Defaults to `'mongodb://localhost:27017'`.
- `database` (string): The MongoDB database name. Defaults to `'launchdarkly'`.
- `prefix` (string): A prefix for all collection names. No default; if not provided, collections use their default names.
- `connectTimeoutMS` (number): Maximum time to wait for connection establishment in milliseconds. Defaults to `10000` (10 seconds).
- `maxRetries` (number): Number of connection retry attempts. Defaults to `3`.
- `retryDelayMS` (number): Time to wait between retries in milliseconds. Defaults to `1000` (1 second).
- `clientOptions` (MongoClientOptions): Additional MongoDB client options that will be merged with defaults.

Example with all options:

```javascript
const store = MongoDBBigSegmentStore({
  uri: 'mongodb://user:password@localhost:27017/mydb?authSource=admin',
  database: 'feature_flags',
  prefix: 'app1_',
  connectTimeoutMS: 5000,
  maxRetries: 5,
  retryDelayMS: 2000,
  clientOptions: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    ssl: true
  }
});
```

## MongoDB setup

Before using the MongoDB big segment store, you'll need to set up your MongoDB database. The store will automatically create the necessary collections when they're first accessed.

### Collections

The MongoDB big segment store uses two collections:

1. **Metadata Collection** (`big_segments_metadata` or `{prefix}big_segments_metadata`): Stores metadata about when the big segments were last synchronized.
2. **User Collection** (`big_segments_user` or `{prefix}big_segments_user`): Stores user membership data (which segments include/exclude specific users).

### Indexes

For optimal performance, consider adding indexes to your collections:

```javascript
// Connect to your MongoDB instance
const { MongoClient } = require('mongodb');
const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const db = client.db('launchdarkly');

// Create index on user hash for fast lookups
await db.collection('big_segments_user').createIndex({ userHash: 1 });

// If using a prefix, adjust collection names accordingly
await db.collection('ld_big_segments_user').createIndex({ userHash: 1 });
```

## Data structure

### Metadata Document

```javascript
{
  _id: "big_segments_metadata",
  lastUpToDate: 1640995200000  // Unix timestamp in milliseconds
}
```

### User Membership Document

```javascript
{
  userHash: "is_hashed:user123",
  included: ["segment1", "segment2"],    // Segments this user is explicitly included in
  excluded: ["segment3"]                // Segments this user is explicitly excluded from
}
```

## Big Segments

Big Segments are a specific type of user segments. For more information, read the LaunchDarkly documentation: [https://docs.launchdarkly.com/home/users/big-segments](https://docs.launchdarkly.com/home/users/big-segments)

## Caching behavior

To reduce database traffic, the SDK has an internal cache for Big Segments. The cache duration is set to 5 minutes by default. You can configure this and other caching parameters in the SDK's `bigSegments` configuration.

```javascript
const client = ld.init('YOUR_SDK_KEY', {
  bigSegments: {
    store: MongoDBBigSegmentStore({
      uri: 'mongodb://localhost:27017'
    }),
    userCacheSize: 1000,        // Maximum number of users to cache
    userCacheTimeSeconds: 300,  // Cache duration (5 minutes)
    staleAfterSeconds: 120,     // Consider data stale after 2 minutes
    statusPollIntervalSeconds: 5 // How often to poll store status
  }
});
```

## Error handling

The MongoDB big segment store includes built-in error handling and retry logic:

- **Connection errors**: Automatic retry with exponential backoff
- **Network timeouts**: Configurable timeout and retry settings
- **Transient errors**: Automatic retry for temporary MongoDB issues
- **Connection pooling**: Efficient connection reuse

Errors are logged using the SDK's logger if one is configured.

## Security considerations

When using MongoDB in production:

1. **Authentication**: Use strong credentials and enable authentication
2. **SSL/TLS**: Enable encryption for data in transit
3. **Network security**: Restrict network access to MongoDB instances
4. **Authorization**: Use role-based access control (RBAC)
5. **Monitoring**: Monitor for unusual access patterns

Example secure configuration:

```javascript
const store = MongoDBBigSegmentStore({
  uri: 'mongodb://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority',
  clientOptions: {
    ssl: true,
    authSource: 'admin',
    readPreference: 'secondaryPreferred'
  }
});
```

## Performance optimization

For better performance in production environments:

1. **Indexes**: Create appropriate indexes on the `userHash` field
2. **Connection pooling**: Configure `maxPoolSize` based on your application needs
3. **Read preferences**: Use `secondaryPreferred` for read replicas if available
4. **Write concerns**: Configure appropriate write concerns for your consistency requirements

## Testing

The package includes comprehensive unit and integration tests. To run tests locally:

```bash
# Make sure MongoDB is running locally
npm test
```

For integration tests, ensure you have a MongoDB instance running on `mongodb://localhost:27017`.

## Development

To work on this package:

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the package
npm run build

# Run linting
npm run lint
```

## Learn more

Check out our [documentation](http://docs.launchdarkly.com) for in-depth instructions on configuring and using LaunchDarkly. You can also head straight to the [complete reference guide for the Node.js SDK](https://docs.launchdarkly.com/sdk/server-side/node-js) or the [API reference](https://launchdarkly.github.io/js-core/packages/sdk/server-node/docs/).

## Contributing

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](../../CONTRIBUTING.md) for instructions on how to contribute to this SDK.

## About LaunchDarkly

* LaunchDarkly is a continuous delivery platform that provides feature flags as a service and allows developers to iterate quickly and safely. We allow you to easily flag your features and manage them from the LaunchDarkly dashboard.  With LaunchDarkly, you can:
    * Roll out a new feature to a subset of your users (like a group of users who opt-in to a beta program), gathering feedback and bug reports from real-world use cases.
    * Gradually roll out a feature to an increasing percentage of users, and track the effect that the feature has on key metrics (for instance, how likely is a user to complete a purchase if they have feature A versus feature B?).
    * Turn off a feature that you realize is causing performance problems in production, without needing to re-deploy, or even restart the application with a changed configuration file.
    * Grant access to certain features based on user attributes, like payment plan (eg: users on the 'gold' plan get access to more features than users in the 'silver' plan). Disable parts of your application to facilitate maintenance, without taking everything offline.
* LaunchDarkly provides feature flag SDKs for a wide variety of languages and technologies. Read [our documentation](https://docs.launchdarkly.com/sdk) for a complete list.
* Explore LaunchDarkly
    * [launchdarkly.com](https://www.launchdarkly.com/ "LaunchDarkly Main Website") for more information
    * [docs.launchdarkly.com](https://docs.launchdarkly.com/  "LaunchDarkly Documentation") for our documentation and SDK reference guides
    * [apidocs.launchdarkly.com](https://apidocs.launchdarkly.com/  "LaunchDarkly API Documentation") for our API documentation
    * [blog.launchdarkly.com](https://blog.launchdarkly.com/  "LaunchDarkly Blog Documentation") for the latest product updates

[npm-badge]: https://img.shields.io/npm/v/@launchdarkly/node-server-sdk-mongodb.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/@launchdarkly/node-server-sdk-mongodb
[ci-badge]: https://github.com/launchdarkly/js-core/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/launchdarkly/js-core/actions/workflows/ci.yml
[docs-badge]: https://img.shields.io/static/v1?label=GitHub+Pages&message=API+reference&color=00add8
[docs-url]: https://launchdarkly.github.io/js-core/packages/store/node-server-sdk-mongodb/docs/
