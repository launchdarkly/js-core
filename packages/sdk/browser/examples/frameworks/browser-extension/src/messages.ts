/**
 * Messages that the extension parts send to each other.
 *
 * This file holds only types. Each part imports it with `import type`, so this file adds no code
 * to the bundles.
 */

/** The popup or a content script asks the background worker for the current flag value. */
export interface GetFlagMessage {
  type: 'GET_FLAG';
}

/**
 * The flag value. The background worker sends it as the response to `GET_FLAG`, and it also
 * sends it to the popup and to every tab when the flag value changes.
 */
export interface FlagValueMessage {
  type: 'FLAG_VALUE';
  flagKey: string;
  value: unknown;
  /** The SDK data source state, for example `VALID` or `INTERRUPTED`. */
  dataSourceState?: string;
}

/** The background worker sends this to the popup when the SDK data source state changes. */
export interface DataSourceStateMessage {
  type: 'DATA_SOURCE_STATE';
  state: string;
}
