# Changelog

All notable changes to the LaunchDarkly Server-Side SDK for Node.js MongoDB store will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-09-27

### Added
- Initial release of the MongoDB big segment store for the LaunchDarkly Server-Side SDK for Node.js
- Support for MongoDB big segment data storage and retrieval
- Configurable connection options including URI, database name, and collection prefix
- Automatic connection retry logic with configurable retry attempts and delays
- Connection pooling and efficient resource management
- Comprehensive error handling and logging
- Full TypeScript support with type definitions
- Unit and integration tests
- Documentation and usage examples

### Features
- **MongoDBBigSegmentStore**: Core implementation of the BigSegmentStore interface
- **MongoDBBigSegmentStoreFactory**: Factory function for creating store instances
- **MongoDBClientState**: Connection and state management for MongoDB operations
- **LDMongoDBOptions**: Comprehensive configuration options interface

### Configuration Options
- `uri`: MongoDB connection string (default: 'mongodb://localhost:27017')
- `database`: Database name (default: 'launchdarkly')
- `prefix`: Collection name prefix (optional)
- `connectTimeoutMS`: Connection timeout in milliseconds (default: 10000)
- `maxRetries`: Maximum connection retry attempts (default: 3)
- `retryDelayMS`: Retry delay in milliseconds (default: 1000)
- `clientOptions`: Additional MongoDB client options

### Collections
- `big_segments_metadata`: Stores synchronization metadata
- `big_segments_user`: Stores user membership data

[1.0.0]: https://github.com/launchdarkly/js-core/releases/tag/node-server-sdk-mongodb-v1.0.0