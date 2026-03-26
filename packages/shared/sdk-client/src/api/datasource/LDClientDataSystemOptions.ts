import FDv2ConnectionMode from './FDv2ConnectionMode';
import { ModeDefinition } from './ModeDefinition';

// When FDv2 becomes the default, this should be integrated into the
// main LDOptions interface (api/LDOptions.ts).

/**
 * Configuration for the FDv2 client-side data system.
 *
 * This interface is not stable, and not subject to any backwards compatibility
 * guarantees or semantic versioning. It is in early access. If you want access
 * to this feature please join the EAP.
 * https://launchdarkly.com/docs/sdk/features/data-saving-mode
 */
export interface LDClientDataSystemOptions {
  /**
   * Controls how the SDK switches between connection modes.
   *
   * - `true` — enable all automatic switching (lifecycle + network)
   * - `false` — disable all automatic switching; uses the platform default
   *   foreground mode
   * - {@link AutomaticModeSwitchingConfig} — granular control over which
   *   platform events trigger automatic mode switches
   * - {@link ManualModeSwitching} — disable automatic switching and specify
   *   the initial connection mode explicitly
   *
   * Default is `true` for mobile SDKs, `false` for browser.
   */
  automaticModeSwitching?: boolean | AutomaticModeSwitchingConfig | ManualModeSwitching;

  /**
   * Override the data source pipeline for specific connection modes.
   *
   * Each key is a connection mode name (`'streaming'`, `'polling'`, `'offline'`,
   * `'one-shot'`, `'background'`). The value defines the initializers and
   * synchronizers for that mode, replacing the built-in defaults.
   *
   * Only the modes you specify are overridden — unspecified modes retain
   * their built-in definitions.
   *
   * @example
   * ```
   * connectionModes: {
   *   streaming: {
   *     initializers: [{ type: 'polling' }],
   *     synchronizers: [{ type: 'streaming' }],
   *   },
   * }
   * ```
   */
  connectionModes?: Partial<Record<FDv2ConnectionMode, ModeDefinition>>;
}

/**
 * Granular control over which platform events trigger automatic mode switches.
 *
 * This interface is not stable, and not subject to any backwards compatibility
 * guarantees or semantic versioning. It is in early access. If you want access
 * to this feature please join the EAP.
 * https://launchdarkly.com/docs/sdk/features/data-saving-mode
 */
export interface AutomaticModeSwitchingConfig {
  /** Discriminant — selects automatic mode switching. */
  readonly type: 'automatic';

  /**
   * Whether to automatically switch modes in response to application lifecycle
   * events (foreground/background on mobile, visibility changes on browser).
   *
   * @defaultValue true on mobile, false on browser/desktop
   */
  readonly lifecycle?: boolean;

  /**
   * Whether to automatically pause/resume data sources in response to
   * network availability changes.
   *
   * @defaultValue true on mobile, false on desktop
   */
  readonly network?: boolean;
}

/**
 * Disable automatic switching and specify the initial connection mode.
 *
 * Subsequent mode transitions must be triggered explicitly via
 * {@link FDv2DataManagerControl.setConnectionMode}.
 *
 * This interface is not stable, and not subject to any backwards compatibility
 * guarantees or semantic versioning. It is in early access. If you want access
 * to this feature please join the EAP.
 * https://launchdarkly.com/docs/sdk/features/data-saving-mode
 */
export interface ManualModeSwitching {
  /** Discriminant — selects manual mode switching. */
  readonly type: 'manual';

  /**
   * The connection mode to use when the SDK starts.
   */
  initialConnectionMode: FDv2ConnectionMode;
}
