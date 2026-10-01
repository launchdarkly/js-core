import { Redis } from 'ioredis';

import { LDLogger } from '@launchdarkly/node-server-sdk';

import LDRedisOptions from './LDRedisOptions';

const DEFAULT_PREFIX = 'launchdarkly';

/**
 * A clock that a system time step cannot move. Older runtimes without performance
 * fall back to the wall clock.
 */
function monotonicNow(): number {
  if (typeof performance !== 'undefined') {
    return performance.now();
  }
  return Date.now();
}

/**
 * Class for managing the state of a redis connection.
 *
 * Used for the redis persistent store as well as the redis big segment store.
 *
 * @internal
 */
export default class RedisClientState {
  private _connected: boolean = false;

  private _disconnectedSince?: number;

  private _attempt: number = 0;

  private _initialConnection: boolean = true;

  private readonly _client: Redis;

  private readonly _owned: boolean;

  private readonly _basePrefix: string;

  /**
   * Construct a state with the given client.
   *
   * @param client The client for which state is being tracked.
   * @param owned Is this client owned by the store integration, or was it
   * provided externally.
   */
  constructor(
    options?: LDRedisOptions,
    private readonly _logger?: LDLogger,
  ) {
    if (options?.client) {
      this._client = options.client;
      this._owned = false;
    } else if (options?.redisOpts) {
      this._client = new Redis(options.redisOpts);
      this._owned = true;
    } else {
      this._client = new Redis();
      this._owned = true;
    }

    this._basePrefix = options?.prefix || DEFAULT_PREFIX;

    // If the client is not owned, then it should already be connected.
    this._connected = !this._owned;
    // We don't want to log a message on the first connection, only when reconnecting.
    this._initialConnection = !this._connected;

    const { _client: client } = this;

    client.on('error', (err) => {
      _logger?.error(`Redis error - ${err}`);
    });

    client.on('reconnecting', (delay: number) => {
      this._attempt += 1;
      _logger?.info(
        `Attempting to reconnect to redis (attempt # ${this._attempt}, delay: ${delay}ms)`,
      );
    });

    client.on('connect', () => {
      if (!this._initialConnection) {
        this._logger?.warn('Reconnecting to Redis');
      }
    });

    client.on('ready', () => {
      this._attempt = 0;
      this._initialConnection = false;
      this._connected = true;
      this._disconnectedSince = undefined;
    });

    // The close event fires again on every failed reconnect attempt, so the
    // disconnect time is anchored at the first close only.
    client.on('close', () => {
      this._connected = false;
      this._disconnectedSince ??= monotonicNow();
    });

    client.on('end', () => {
      this._connected = false;
      this._disconnectedSince ??= monotonicNow();
    });
  }

  /**
   * Get the connection state.
   *
   * @returns True if currently connected.
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Get how long the connection has been down.
   *
   * @returns The time in milliseconds since the connection dropped, or 0 when connected.
   */
  disconnectedForMs(): number {
    if (this._disconnectedSince === undefined) {
      return 0;
    }
    return monotonicNow() - this._disconnectedSince;
  }

  /**
   * Get is the client is using its initial connection.
   *
   * @returns True if using the initial connection.
   */
  isInitialConnection(): boolean {
    return this._initialConnection;
  }

  /**
   * Get the redis client.
   *
   * @returns The redis client.
   */
  getClient(): Redis {
    return this._client;
  }

  /**
   * If the client is owned, then this will 'quit' the client.
   */
  close() {
    if (this._owned) {
      this._client.quit().catch((err) => {
        // Not any action that can be taken for an error on quit.
        this._logger?.debug('Error closing ioredis client:', err);
      });
    }
  }

  /**
   * Get a key with prefix prepended.
   * @param key The key to prefix.
   * @returns The prefixed key.
   */
  prefixedKey(key: string): string {
    return `${this._basePrefix}:${key}`;
  }
}
