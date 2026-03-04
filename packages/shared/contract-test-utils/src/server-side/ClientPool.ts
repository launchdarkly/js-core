/**
 * ClientPool is a generic pool that manages a collection of client entities.
 * It provides methods to add, retrieve, remove, and generate IDs for clients.
 *
 * This eliminates duplication of the Record<string, Entity> + counter pattern
 * used across multiple contract test implementations.
 */
export class ClientPool<T> {
  private _clients: Record<string, T> = {};
  private _clientCounter = 0;

  /**
   * Generate a new unique client ID and increment the counter.
   * @returns A new unique string ID for the client.
   */
  nextId(): string {
    this._clientCounter += 1;
    return this._clientCounter.toString();
  }

  /**
   * Add a client entity to the pool with the given ID.
   * @param id - The unique identifier for the client.
   * @param client - The client entity to store.
   */
  add(id: string, client: T): void {
    this._clients[id] = client;
  }

  /**
   * Retrieve a client entity by its ID.
   * @param id - The unique identifier for the client.
   * @returns The client entity, or undefined if not found.
   */
  get(id: string): T | undefined {
    return this._clients[id];
  }

  /**
   * Check if a client entity exists in the pool.
   * @param id - The unique identifier for the client.
   * @returns True if the client exists.
   */
  has(id: string): boolean {
    return Object.prototype.hasOwnProperty.call(this._clients, id);
  }

  /**
   * Remove a client entity from the pool by its ID.
   * @param id - The unique identifier for the client.
   * @returns True if the client was removed, false if it did not exist.
   */
  remove(id: string): boolean {
    if (this.has(id)) {
      delete this._clients[id];
      return true;
    }
    return false;
  }
}
