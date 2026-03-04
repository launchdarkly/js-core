import type FDv2ConnectionMode from './FDv2ConnectionMode';

/**
 * The lifecycle state of the application.
 *
 * - `'foreground'` — The application is in the foreground (visible, active).
 *   Browser and desktop platforms always use this value.
 * - `'background'` — The application is in the background (not visible).
 *   Only applicable to mobile platforms.
 */
type LifecycleState = 'foreground' | 'background';

/**
 * Input state used by the mode resolution table to determine the connection
 * mode. The caller is responsible for computing the effective `foregroundMode`
 * before consulting the table — for example, browser listener-driven streaming
 * logic modifies `foregroundMode` externally.
 */
export interface ModeState {
  /** Application lifecycle state. */
  readonly lifecycle: LifecycleState;

  /** Whether the device has network connectivity. */
  readonly networkAvailable: boolean;

  /**
   * The effective foreground connection mode. This is the mode the SDK should
   * use when in the foreground and online. The caller computes this from
   * user configuration, platform defaults, and any platform-specific logic
   * (e.g., browser listener-driven streaming promotion).
   */
  readonly foregroundMode: FDv2ConnectionMode;

  /**
   * The effective background connection mode. This is the mode the SDK should
   * use when in the background and online. Only meaningful on mobile platforms.
   */
  readonly backgroundMode: FDv2ConnectionMode;
}

/**
 * A reference to a configured mode slot in the {@link ModeState}. Used in
 * table entries to defer the mode decision to the caller's configuration.
 *
 * - `{ configured: 'foreground' }` — Resolve to `input.foregroundMode`.
 * - `{ configured: 'background' }` — Resolve to `input.backgroundMode`.
 */
export interface ConfiguredMode {
  readonly configured: 'foreground' | 'background';
}

/**
 * The result of a mode resolution entry. Either:
 * - A literal {@link FDv2ConnectionMode} string (e.g., `'offline'`).
 * - A {@link ConfiguredMode} object referencing a configured mode slot.
 */
type ModeResolution = FDv2ConnectionMode | ConfiguredMode;

/**
 * A single entry in a mode resolution table. Entries are evaluated in order;
 * the first entry whose conditions all match the input state determines the
 * connection mode.
 */
export interface ModeResolutionEntry {
  /**
   * Conditions to match against the input state. All specified fields must
   * match for this entry to apply. Unspecified fields match any value. An
   * empty object matches all inputs (catch-all).
   */
  readonly conditions: Partial<ModeState>;

  /**
   * The mode to resolve to when this entry matches.
   */
  readonly mode: ModeResolution;
}

/**
 * An ordered list of mode resolution entries. The first matching entry
 * determines the connection mode. Tables should end with a catch-all
 * entry (empty conditions) to guarantee a match.
 */
type ModeResolutionTable = ReadonlyArray<ModeResolutionEntry>;

export type { LifecycleState, ModeResolution, ModeResolutionTable };
