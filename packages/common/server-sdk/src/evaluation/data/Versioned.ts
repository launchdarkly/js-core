/**
 * Common interface for flags/segments. Versioned data we store.
 */
export interface Versioned {
  key: string;
  version: number;
}
