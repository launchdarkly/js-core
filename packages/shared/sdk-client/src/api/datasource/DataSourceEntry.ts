/**
 * Endpoint overrides for a network data source entry. Allows routing specific
 * sources to different infrastructure (e.g., a relay proxy as a fallback).
 *
 * When not specified, the SDK uses `baseUri` for polling and `streamUri` for
 * streaming from the base SDK configuration.
 */
export interface EndpointConfig {
  /** Override for the polling base URI. Defaults to `baseUri` from SDK configuration. */
  readonly pollingBaseUri?: string;
  /** Override for the streaming base URI. Defaults to `streamUri` from SDK configuration. */
  readonly streamingBaseUri?: string;
}

/**
 * Configuration for a cache data source entry.
 */
export interface CacheDataSourceEntry {
  readonly type: 'cache';
}

/**
 * Configuration for a polling data source entry.
 */
export interface PollingDataSourceEntry {
  readonly type: 'polling';

  /** Override for the polling interval, in seconds. */
  readonly pollInterval?: number;

  /** Endpoint overrides for this polling source. */
  readonly endpoints?: EndpointConfig;
}

/**
 * Configuration for a streaming data source entry.
 */
export interface StreamingDataSourceEntry {
  readonly type: 'streaming';

  /** Override for the initial reconnect delay, in seconds. */
  readonly initialReconnectDelay?: number;

  /** Endpoint overrides for this streaming source. */
  readonly endpoints?: EndpointConfig;
}

/**
 * A data source entry in a mode table. Each entry identifies a data source type
 * and carries type-specific configuration overrides.
 */
export type DataSourceEntry =
  | CacheDataSourceEntry
  | PollingDataSourceEntry
  | StreamingDataSourceEntry;
