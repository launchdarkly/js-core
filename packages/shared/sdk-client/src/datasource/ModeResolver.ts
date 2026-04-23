import type {
  ConfiguredMode,
  FDv2ConnectionMode,
  ModeResolutionTable,
  ModeState,
} from '../api/datasource';

function allConditionsMatch(conditions: Partial<ModeState>, input: ModeState): boolean {
  return Object.entries(conditions).every(
    ([key, value]) => value === undefined || input[key as keyof ModeState] === value,
  );
}

/**
 * Given a mode resolution table and the current input state, returns the
 * resolved FDv2 connection mode.
 *
 * Iterates entries in order. The first entry whose conditions all match the
 * input wins. If no entry matches (should not happen when the table ends with
 * a catch-all), falls back to `input.foregroundMode`.
 */
const CONFIGURED_MODE_MAP: Record<ConfiguredMode['configured'], keyof ModeState> = {
  foreground: 'foregroundMode',
  background: 'backgroundMode',
};

function resolveConnectionMode(table: ModeResolutionTable, input: ModeState): FDv2ConnectionMode {
  const match = table.find((entry) => allConditionsMatch(entry.conditions, input));
  if (match) {
    const { mode } = match;
    if (typeof mode === 'object') {
      return input[CONFIGURED_MODE_MAP[mode.configured]] as FDv2ConnectionMode;
    }
    return mode;
  }
  return input.foregroundMode;
}

/**
 * Mode resolution table for mobile platforms (React Native, etc.).
 *
 * - No network → offline.
 * - Background → configured background mode.
 * - Foreground → configured foreground mode.
 */
const MOBILE_TRANSITION_TABLE: ModeResolutionTable = [
  { conditions: { networkAvailable: false }, mode: 'offline' },
  { conditions: { lifecycle: 'background' }, mode: { configured: 'background' } },
  { conditions: { lifecycle: 'foreground' }, mode: { configured: 'foreground' } },
];

/**
 * Mode resolution table for browser platforms.
 *
 * - No network → offline.
 * - Otherwise → configured foreground mode.
 *
 * Browser listener-driven streaming (auto-promotion to streaming when change
 * listeners are registered) is handled externally by the caller modifying
 * `foregroundMode` before consulting this table.
 */
const BROWSER_TRANSITION_TABLE: ModeResolutionTable = [
  { conditions: { networkAvailable: false }, mode: 'offline' },
  { conditions: {}, mode: { configured: 'foreground' } },
];

/**
 * Mode resolution table for desktop platforms (Electron, etc.).
 *
 * - No network → offline.
 * - Otherwise → configured foreground mode.
 */
const DESKTOP_TRANSITION_TABLE: ModeResolutionTable = [
  { conditions: { networkAvailable: false }, mode: 'offline' },
  { conditions: {}, mode: { configured: 'foreground' } },
];

export {
  BROWSER_TRANSITION_TABLE,
  DESKTOP_TRANSITION_TABLE,
  MOBILE_TRANSITION_TABLE,
  resolveConnectionMode,
};
