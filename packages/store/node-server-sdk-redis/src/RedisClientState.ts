import { Redis } from 'ioredis';

import { LDLogger } from '@launchdarkly/node-server-sdk';

import LDRedisOptions from './LDRedisOptions';

const DEFAULT_PREFIX = 'launchdarkly';

/**
 * Class for managing the state of a redis connection.
 *
 * Used for the redis persistent store as well as the redis big segment store.
 *
 * @internal
 */
export default class RedisClientState {
  private connected: boolean = false;

  private attempt: number = 0;

  private initialConnection: boolean = true;

  private readonly client: Redis;

  private readonly owned: boolean;

  private readonly base_prefix: string;

  /**
   * Construct a state with the given client.
   *
   * @param client The client for which state is being tracked.
   * @param owned Is this client owned by the store integration, or was it
   * provided externally.
   */
  constructor(
    options?: LDRedisOptions,
    private readonly logger?: LDLogger,
  ) {
    if (options?.client) {
      this.client = options.client;
      this.owned = false;
    } else if (options?.redisOpts) {
      this.client = new Redis(options.redisOpts);
      this.owned = true;
    } else {
      this.client = new Redis();
      this.owned = true;
    }

    this.base_prefix = options?.prefix || DEFAULT_PREFIX;

    // If the client is not owned, then it should already be connected.
    this.connected = !this.owned;
    // We don't want to log a message on the first connection, only when reconnecting.
    this.initialConnection = !this.connected;

    const { client } = this;

    client.on('error', (err) => {
      logger?.error(`Redis error - ${err}`);
    });

    client.on('reconnecting', (delay: number) => {
      this.connected = false;
      this.attempt += 1;
      logger?.info(
        `Attempting to reconnect to redis (attempt # ${this.attempt}, delay: ${delay}ms)`,
      );
    });

    client.on('connect', () => {
      this.attempt = 0;

      if (!this.initialConnection) {
        this?.logger?.warn('Reconnecting to Redis');
      }

      this.initialConnection = false;
      this.connected = true;
    });

    client.on('end', () => {
      this.connected = false;
    });
  }

  /**
   * Get the connection state.
   *
   * @returns True if currently connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get is the client is using its initial connection.
   *
   * @returns True if using the initial connection.
   */
  isInitialConnection(): boolean {
    return this.initialConnection;
  }

  /**
   * Get the redis client.
   *
   * @returns The redis client.
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * If the client is owned, then this will 'quit' the client.
   */
  close() {
    if (this.owned) {
      this.client.quit().catch((err) => {
        // Not any action that can be taken for an error on quit.
        this.logger?.debug('Error closing ioredis client:', err);
      });
    }
  }

  /**
   * Get a key with prefix prepended.
   * @param key The key to prefix.
   * @returns The prefixed key.
   */
  prefixedKey(key: string): string {
    return `${this.base_prefix}:${key}`;
  }
}
