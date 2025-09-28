import { Collection, Db, MongoClient, MongoServerError } from 'mongodb';

import LDMongoDBOptions from './LDMongoDBOptions';

/**
 * Manages the MongoDB client state and connections.
 * @internal
 */
export default class MongoDBClientState {
  private _client: MongoClient | undefined;

  private _db: Db | undefined;

  private _isConnected: boolean = false;

  private _prefix: string;

  private readonly _maxRetries: number;

  private readonly _retryDelayMS: number;

  constructor(private readonly _options?: LDMongoDBOptions) {
    this._prefix = _options?.prefix ?? '';
    this._maxRetries = _options?.maxRetries ?? 3;
    this._retryDelayMS = _options?.retryDelayMS ?? 1000;
  }

  /**
   * Gets the prefixed collection name.
   */
  public prefixedCollection(name: string): string {
    return this._prefix ? `${this._prefix}${name}` : name;
  }

  /**
   * Gets the MongoDB database instance, connecting if necessary.
   */
  public async getDatabase(): Promise<Db> {
    if (!this._isConnected) {
      await this._connect();
    }
    return this._db!;
  }

  /**
   * Gets a MongoDB collection by name.
   */
  public async getCollection<T = any>(name: string): Promise<Collection<T>> {
    const db = await this.getDatabase();
    return db.collection<T>(this.prefixedCollection(name));
  }

  /**
   * Closes the MongoDB connection.
   */
  public close(): void {
    if (this._client) {
      this._client.close();
      this._client = undefined;
      this._db = undefined;
      this._isConnected = false;
    }
  }

  /**
   * Connects to MongoDB with retry logic.
   */
  private async _connect(): Promise<void> {
    const uri = this._options?.uri ?? 'mongodb://localhost:27017';
    const databaseName = this._options?.database ?? 'launchdarkly';
    const connectTimeoutMS = this._options?.connectTimeoutMS ?? 10000;

    const clientOptions = {
      connectTimeoutMS,
      serverSelectionTimeoutMS: connectTimeoutMS,
      ...this._options?.clientOptions,
    };

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
      try {
        this._client = new MongoClient(uri, clientOptions);
        await this._client.connect();
        this._db = this._client.db(databaseName);
        this._isConnected = true;
        return;
      } catch (error) {
        lastError = error as Error;
        this.close();

        if (attempt < this._maxRetries) {
          await this._delay(this._retryDelayMS);
        }
      }
    }

    throw new Error(
      `Failed to connect to MongoDB after ${this._maxRetries + 1} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Delays execution for the specified number of milliseconds.
   */
  private async _delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Checks if the error is a transient error that should be retried.
   */
  private _isTransientError(error: any): boolean {
    if (error instanceof MongoServerError) {
      // Network errors, timeouts, and certain server errors are retryable
      return (
        error.code === 11000 || // Duplicate key error (could be temporary in some cases)
        error.code === 50 || // ExceededTimeLimit
        error.code === 89 || // NetworkTimeout
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('connection')
      );
    }
    return false;
  }
}