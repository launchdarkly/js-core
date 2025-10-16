import { MongoClientOptions } from 'mongodb';

/**
 * Configuration options for the MongoDB big segment store.
 */
export default interface LDMongoDBOptions {
  /**
   * The MongoDB connection URI. If not provided, defaults to 'mongodb://localhost:27017'.
   */
  uri?: string;

  /**
   * The MongoDB database name. If not provided, defaults to 'launchdarkly'.
   */
  database?: string;

  /**
   * A prefix string to prepend to all MongoDB collection names. If not provided,
   * collections will use their default names without a prefix.
   */
  prefix?: string;

  /**
   * The maximum time to wait for a connection to be established, in milliseconds.
   * If not provided, defaults to 10000 (10 seconds).
   */
  connectTimeoutMS?: number;

  /**
   * Additional MongoDB client options. These will be merged with the default options.
   */
  clientOptions?: MongoClientOptions;

  /**
   * The number of connection retries to attempt before giving up.
   * If not provided, defaults to 3.
   */
  maxRetries?: number;

  /**
   * The time to wait between connection retries, in milliseconds.
   * If not provided, defaults to 1000 (1 second).
   */
  retryDelayMS?: number;

  /**
   * The cache time-to-live (TTL) in seconds. If not provided, defaults to 30 seconds.
   * Set to 0 to disable caching.
   */
  cacheTTL?: number;
}
