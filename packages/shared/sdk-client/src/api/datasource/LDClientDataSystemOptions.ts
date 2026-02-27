import FDv2ConnectionMode from './FDv2ConnectionMode';

/**
 * Configuration for the FDv2 client-side data system.
 *
 * When FDv2 becomes the default, this should be integrated into the
 * main LDOptions interface (api/LDOptions.ts).
 */
export interface LDClientDataSystemOptions {
  /**
   * The initial connection mode the SDK should use.
   *
   * If not specified, the platform SDK provides a default:
   * - Browser: 'one-shot'
   * - React Native: 'streaming'
   * - Electron: 'streaming'
   *
   * See {@link FDv2ConnectionMode} for the available modes.
   */
  initialConnectionMode?: FDv2ConnectionMode;

  /**
   * The connection mode to use when the application transitions to the background.
   *
   * This is primarily used by mobile SDKs (React Native). When the application
   * enters the background, the SDK switches to this mode. When returning to
   * the foreground, it switches back to the foreground mode.
   *
   * Set to undefined or omit to disable automatic background mode switching.
   * Set to 'background' to use the built-in background mode (polling @ 1hr).
   * Set to 'offline' to stop all connections in the background.
   */
  backgroundConnectionMode?: FDv2ConnectionMode;

  /**
   * Controls automatic mode switching in response to platform events.
   *
   * - `true` — enable all automatic switching (lifecycle + network)
   * - `false` — disable all automatic switching; the user manages modes manually
   * - `{ lifecycle?: boolean, network?: boolean }` — granular control over
   *   which platform events trigger automatic mode switches
   *
   * `lifecycle` controls foreground/background transitions (mobile) and
   * visibility changes (browser). `network` controls pause/resume of data
   * sources when network availability changes.
   *
   * Default is true for mobile SDKs, false/ignored for browser.
   */
  automaticModeSwitching?: boolean | AutomaticModeSwitchingConfig;

  // Req 5.3.5 TBD — custom named modes reserved for future use.
  // customModes?: Record<string, { initializers: ..., synchronizers: ... }>;
}

/**
 * Granular control over which platform events trigger automatic mode switches.
 */
export interface AutomaticModeSwitchingConfig {
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
 * Platform-specific default configuration for the FDv2 data system.
 */
export interface PlatformDataSystemDefaults {
  /** The default initial connection mode for this platform. */
  readonly initialConnectionMode: FDv2ConnectionMode;
  /** The default background connection mode, if any. */
  readonly backgroundConnectionMode?: FDv2ConnectionMode;
  /** Whether automatic mode switching is enabled by default. */
  readonly automaticModeSwitching: boolean | AutomaticModeSwitchingConfig;
}
