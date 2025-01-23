/**
 * Minimal client interface which allows waiting for initialization.
 */
export interface LDClientInitialization {
  waitForInitialization(timeout?: number): Promise<void>;
}
