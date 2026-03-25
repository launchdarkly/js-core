import { TypeValidators } from '@launchdarkly/js-sdk-common';

import type FDv2ConnectionMode from '../api/datasource/FDv2ConnectionMode';
import type {
  LDClientDataSystemOptions,
  ManualModeSwitching,
  PlatformDataSystemDefaults,
} from '../api/datasource/LDClientDataSystemOptions';
import { anyOf, validatorOf } from '../configuration/validateOptions';
import { connectionModesValidator, connectionModeValidator } from './ConnectionModeConfig';

function hasType(u: unknown, type: string): boolean {
  return TypeValidators.Object.is(u) && (u as Record<string, unknown>).type === type;
}

const automaticModeValidators = {
  type: TypeValidators.oneOf('automatic'),
  lifecycle: TypeValidators.Boolean,
  network: TypeValidators.Boolean,
};

const manualModeValidators = {
  type: TypeValidators.oneOf('manual'),
  initialConnectionMode: connectionModeValidator,
};

const dataSystemValidators = {
  backgroundConnectionMode: connectionModeValidator,
  automaticModeSwitching: anyOf(
    TypeValidators.Boolean,
    validatorOf(automaticModeValidators, { is: (u) => hasType(u, 'automatic') }),
    validatorOf(manualModeValidators, { is: (u) => hasType(u, 'manual') }),
  ),
  connectionModes: connectionModesValidator,
};

/**
 * Default FDv2 data system configuration for browser SDKs.
 */
const BROWSER_DATA_SYSTEM_DEFAULTS: PlatformDataSystemDefaults = {
  foregroundConnectionMode: 'one-shot',
  backgroundConnectionMode: undefined,
  automaticModeSwitching: false,
};

/**
 * Default FDv2 data system configuration for mobile (React Native) SDKs.
 */
const MOBILE_DATA_SYSTEM_DEFAULTS: PlatformDataSystemDefaults = {
  foregroundConnectionMode: 'streaming',
  backgroundConnectionMode: 'background',
  automaticModeSwitching: true,
};

/**
 * Default FDv2 data system configuration for desktop SDKs (Electron, etc.).
 */
const DESKTOP_DATA_SYSTEM_DEFAULTS: PlatformDataSystemDefaults = {
  foregroundConnectionMode: 'streaming',
  backgroundConnectionMode: undefined,
  automaticModeSwitching: false,
};

function isManualModeSwitching(
  value: LDClientDataSystemOptions['automaticModeSwitching'],
): value is ManualModeSwitching {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === 'manual';
}

/**
 * Resolve the foreground connection mode from a validated data system config
 * and platform defaults. Uses the mode from `ManualModeSwitching` when present,
 * otherwise falls back to the platform default.
 */
function resolveForegroundMode(
  dataSystem: LDClientDataSystemOptions,
  defaults: PlatformDataSystemDefaults,
): FDv2ConnectionMode {
  if (isManualModeSwitching(dataSystem.automaticModeSwitching)) {
    return dataSystem.automaticModeSwitching.initialConnectionMode;
  }
  return defaults.foregroundConnectionMode;
}

export {
  dataSystemValidators,
  resolveForegroundMode,
  BROWSER_DATA_SYSTEM_DEFAULTS,
  MOBILE_DATA_SYSTEM_DEFAULTS,
  DESKTOP_DATA_SYSTEM_DEFAULTS,
};
