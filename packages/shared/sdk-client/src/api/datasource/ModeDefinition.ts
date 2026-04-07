import { FDv1FallbackConfig, InitializerEntry, SynchronizerEntry } from './DataSourceEntry';

/**
 * Defines the data pipeline for a connection mode: which data sources
 * are used during initialization and which are used for ongoing synchronization.
 *
 * This interface is not stable, and not subject to any backwards compatibility
 * guarantees or semantic versioning. It is in early access. If you want access
 * to this feature please join the EAP.
 * https://launchdarkly.com/docs/sdk/features/data-saving-mode
 */
export interface ModeDefinition {
  /**
   * Ordered list of data sources to attempt during initialization.
   * Sources are tried in order; the first that successfully provides a full
   * data set transitions the SDK out of the initialization phase.
   */
  readonly initializers: ReadonlyArray<InitializerEntry>;

  /**
   * Ordered list of data sources for ongoing synchronization after
   * initialization completes. Sources are in priority order with automatic
   * failover to the next source if the primary fails.
   * An empty array means no synchronization occurs (e.g., offline, one-shot).
   */
  readonly synchronizers: ReadonlyArray<SynchronizerEntry>;

  /**
   * Configuration for the FDv1 polling fallback synchronizer for this mode.
   * When the platform provides fdv1Endpoints, a fallback synchronizer is
   * automatically appended to modes with synchronizers. This field controls
   * the poll interval and endpoint overrides for that fallback.
   *
   * When omitted (or when a user overrides a mode without specifying this),
   * the built-in default for the mode is used. The fallback cannot be removed
   * through configuration.
   */
  readonly fdv1Fallback?: FDv1FallbackConfig;
}
