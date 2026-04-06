/**
 * Endpoint overrides for a network data source entry. Allows routing specific
 * sources to different infrastructure (e.g., a relay proxy as a fallback).
 *
 * When not specified, the SDK uses `baseUri` for polling and `streamUri` for
 * streaming from the base SDK configuration.
 *
 * This interface is not stable, and not subject to any backwards compatibility
 * guarantees or semantic versioning. It is in early access. If you want access
 * to this feature please join the EAP.
 * https://launchdarkly.com/docs/sdk/features/data-saving-mode
 */
export interface EndpointConfig {
  /** Override for the polling base URI. Defaults to `baseUri` from SDK configuration. */
  readonly pollingBaseUri?: string;
  /** Override for the streaming base URI. Defaults to `streamUri` from SDK configuration. */
  readonly streamingBaseUri?: string;
}

/**
 * Configuration for a cache data source entry.
 * Cache is only valid as an initializer (not a synchronizer).
 *
 * This interface is not stable, and not subject to any backwards compatibility
 * guarantees or semantic versioning. It is in early access. If you want access
 * to this feature please join the EAP.
 * https://launchdarkly.com/docs/sdk/features/data-saving-mode
 */
export interface CacheDataSourceEntry {
  readonly type: 'cache';
}

/**
 * Configuration for a polling data source entry.
 *
 * This interface is not stable, and not subject to any backwards compatibility
 * guarantees or semantic versioning. It is in early access. If you want access
 * to this feature please join the EAP.
 * https://launchdarkly.com/docs/sdk/features/data-saving-mode
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
 *
 * This interface is not stable, and not subject to any backwards compatibility
 * guarantees or semantic versioning. It is in early access. If you want access
 * to this feature please join the EAP.
 * https://launchdarkly.com/docs/sdk/features/data-saving-mode
 */
export interface StreamingDataSourceEntry {
  readonly type: 'streaming';

  /** Override for the initial reconnect delay, in seconds. */
  readonly initialReconnectDelay?: number;

  /** Endpoint overrides for this streaming source. */
  readonly endpoints?: EndpointConfig;
}

/**
 * Configuration for the FDv1 polling fallback within a mode definition.
 * When fdv1Endpoints is provided at the platform level, this controls
 * how the FDv1 fallback synchronizer behaves for a specific mode.
 *
 * This interface is not stable, and not subject to any backwards compatibility
 * guarantees or semantic versioning. It is in early access. If you want access
 * to this feature please join the EAP.
 * https://launchdarkly.com/docs/sdk/features/data-saving-mode
 */
export interface FDv1FallbackConfig {
  /** Poll interval for the FDv1 fallback in seconds. Minimum 30. */
  readonly pollInterval?: number;

  /** Endpoint overrides for the FDv1 fallback. */
  readonly endpoints?: EndpointConfig;
}

/**
 * An entry in the initializers list of a mode definition. Initializers
 * can be cache, polling, or streaming sources.
 *
 * This type is not stable, and not subject to any backwards compatibility
 * guarantees or semantic versioning. It is in early access. If you want access
 * to this feature please join the EAP.
 * https://launchdarkly.com/docs/sdk/features/data-saving-mode
 */
export type InitializerEntry =
  | CacheDataSourceEntry
  | PollingDataSourceEntry
  | StreamingDataSourceEntry;

/**
 * An entry in the synchronizers list of a mode definition. Synchronizers
 * can be polling or streaming sources (not cache).
 *
 * This type is not stable, and not subject to any backwards compatibility
 * guarantees or semantic versioning. It is in early access. If you want access
 * to this feature please join the EAP.
 * https://launchdarkly.com/docs/sdk/features/data-saving-mode
 */
export type SynchronizerEntry = PollingDataSourceEntry | StreamingDataSourceEntry;

/**
 * A data source entry in a mode table. Each entry identifies a data source type
 * and carries type-specific configuration overrides.
 */
export type DataSourceEntry =
  | CacheDataSourceEntry
  | PollingDataSourceEntry
  | StreamingDataSourceEntry;
