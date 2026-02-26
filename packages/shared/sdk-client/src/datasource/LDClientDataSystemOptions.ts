import FDv2ConnectionMode from './FDv2ConnectionMode';

/**
 * Configuration for the FDv2 client-side data system.
 *
 * When FDv2 becomes the default, this should be integrated into the
 * main LDOptions interface (api/LDOptions.ts).
 *
 * Spec references: Req 5.4.1-5.4.2 (browser defaults),
 *   Req 5.5.1-5.5.3 (mobile defaults and auto-switching)
 */
interface LDClientDataSystemOptions {
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
   *
   * Spec references: Req 5.5.2, 5.5.3
   */
  backgroundConnectionMode?: FDv2ConnectionMode;

  /**
   * Whether to automatically switch between foreground and background
   * connection modes when the application state changes.
   *
   * Default is true for mobile SDKs, false/ignored for browser.
   *
   * Spec reference: Req 5.5.3
   */
  automaticModeSwitching?: boolean;

  // Req 5.3.5 TBD — custom named modes reserved for future use.
  // customModes?: Record<string, { initializers: ..., synchronizers: ... }>;
}

/**
 * Platform-specific default configuration for the FDv2 data system.
 */
interface PlatformDataSystemDefaults {
  /** The default initial connection mode for this platform. */
  readonly initialConnectionMode: FDv2ConnectionMode;
  /** The default background connection mode, if any. */
  readonly backgroundConnectionMode?: FDv2ConnectionMode;
  /** Whether automatic mode switching is enabled by default. */
  readonly automaticModeSwitching: boolean;
}

/**
 * Default FDv2 data system configuration for browser SDKs.
 *
 * Spec reference: Req 5.4.1 — browser defaults to one-shot.
 */
const BROWSER_DATA_SYSTEM_DEFAULTS: PlatformDataSystemDefaults = {
  initialConnectionMode: 'one-shot',
  backgroundConnectionMode: undefined,
  automaticModeSwitching: false,
};

/**
 * Default FDv2 data system configuration for mobile (React Native) SDKs.
 *
 * Spec references:
 * - Req 5.5.1: Mobile defaults to streaming in foreground.
 * - Req 5.5.2: Mobile auto-switches to background mode.
 */
const MOBILE_DATA_SYSTEM_DEFAULTS: PlatformDataSystemDefaults = {
  initialConnectionMode: 'streaming',
  backgroundConnectionMode: 'background',
  automaticModeSwitching: true,
};

/**
 * Default FDv2 data system configuration for Electron/desktop SDKs.
 */
const ELECTRON_DATA_SYSTEM_DEFAULTS: PlatformDataSystemDefaults = {
  initialConnectionMode: 'streaming',
  backgroundConnectionMode: undefined,
  automaticModeSwitching: false,
};

export type { LDClientDataSystemOptions, PlatformDataSystemDefaults };
export { BROWSER_DATA_SYSTEM_DEFAULTS, MOBILE_DATA_SYSTEM_DEFAULTS, ELECTRON_DATA_SYSTEM_DEFAULTS };
