import { LDLogger } from '@launchdarkly/node-server-sdk';
import { Redis } from 'ioredis';

/**
 * Class for managing the state of a redis connection.
 *
 * Used for the redis persistent store as well as the redis big segment store.
 */
export default class RedisClientState {
  private connected: boolean = false;

  private attempt: number = 0;

  private initialConnection: boolean = true;

  /**
   * Construct a state with the given client.
   *
   * @param client The client for which state is being tracked.
   * @param owned Is this client owned by the store integration, or was it
   * provided externally.
   */
  constructor(
    private readonly client: Redis,
    private readonly owned: boolean,
    private readonly logger?: LDLogger
  ) {
    // If the client is not owned, then it should already be connected.
    this.connected = !owned;
    // We don't want to log a message on the first connection, only when reconnecting.
    this.initialConnection = !this.connected;

    client.on('error', (err) => {
      logger?.error(`Redis error - ${err}`);
    });

    client.on('reconnecting', (delay: number) => {
      this.attempt += 1;
      logger?.info(
        `Attempting to reconnect to redis (attempt # ${this.attempt}, delay: ${delay}ms)`
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
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get is the client is using its initial connection.
   *
   * @returns True if using the initial connection.
   */
  public isInitialConnection(): boolean {
    return this.initialConnection;
  }

  /**
   * Get the redis client.
   *
   * @returns The redis client.
   */
  public getClient(): Redis {
    return this.client;
  }

  /**
   * If the client is owned, then this will 'quit' the client.
   */
  public close() {
    if (this.owned) {
      this.client.quit();
    }
  }
}
