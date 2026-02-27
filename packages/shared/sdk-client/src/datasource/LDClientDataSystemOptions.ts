import { LDLogger } from '@launchdarkly/js-sdk-common';

import type {
  AutomaticModeSwitchingConfig,
  FDv2ConnectionMode,
  LDClientDataSystemOptions,
  PlatformDataSystemDefaults,
} from '../api/datasource';
import { isValidFDv2ConnectionMode } from './ConnectionModeConfig';

/**
 * Default FDv2 data system configuration for browser SDKs.
 */
const BROWSER_DATA_SYSTEM_DEFAULTS: PlatformDataSystemDefaults = {
  initialConnectionMode: 'one-shot',
  backgroundConnectionMode: undefined,
  automaticModeSwitching: false,
};

/**
 * Default FDv2 data system configuration for mobile (React Native) SDKs.
 */
const MOBILE_DATA_SYSTEM_DEFAULTS: PlatformDataSystemDefaults = {
  initialConnectionMode: 'streaming',
  backgroundConnectionMode: 'background',
  automaticModeSwitching: true,
};

/**
 * Default FDv2 data system configuration for desktop SDKs (Electron, etc.).
 */
const DESKTOP_DATA_SYSTEM_DEFAULTS: PlatformDataSystemDefaults = {
  initialConnectionMode: 'streaming',
  backgroundConnectionMode: undefined,
  automaticModeSwitching: false,
};

// ----------------------------- Validation --------------------------------

function validateConnectionMode(
  value: unknown,
  name: string,
  logger?: LDLogger,
): FDv2ConnectionMode | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    logger?.warn(
      `Config option "${name}" should be of type string, got ${typeof value}, using default value`,
    );
    return undefined;
  }

  if (!isValidFDv2ConnectionMode(value)) {
    logger?.warn(
      `Config option "${name}" has unknown value "${value}", must be one of: streaming, polling, offline, one-shot, background. Using default value`,
    );
    return undefined;
  }

  return value;
}

function validateAutomaticModeSwitching(
  value: unknown,
  name: string,
  logger?: LDLogger,
): boolean | AutomaticModeSwitchingConfig | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: { lifecycle?: boolean; network?: boolean } = {};

    if (obj.lifecycle !== undefined && obj.lifecycle !== null) {
      if (typeof obj.lifecycle === 'boolean') {
        result.lifecycle = obj.lifecycle;
      } else {
        logger?.warn(
          `Config option "${name}.lifecycle" should be of type boolean, got ${typeof obj.lifecycle}, using default value`,
        );
      }
    }

    if (obj.network !== undefined && obj.network !== null) {
      if (typeof obj.network === 'boolean') {
        result.network = obj.network;
      } else {
        logger?.warn(
          `Config option "${name}.network" should be of type boolean, got ${typeof obj.network}, using default value`,
        );
      }
    }

    return result;
  }

  logger?.warn(
    `Config option "${name}" should be a boolean or object, got ${typeof value}, using default value`,
  );
  return undefined;
}

/**
 * Validates a user-provided LDClientDataSystemOptions, logging warnings for
 * any invalid values and replacing them with defaults from the given platform
 * defaults.
 *
 * @param input The unvalidated options (may have incorrect types).
 * @param defaults Platform-specific defaults to fall back to.
 * @param logger Logger for validation warnings.
 * @returns A validated LDClientDataSystemOptions merged with platform defaults.
 */
function validateDataSystemOptions(
  input: unknown,
  defaults: PlatformDataSystemDefaults,
  logger?: LDLogger,
): LDClientDataSystemOptions {
  if (input === undefined || input === null) {
    return { ...defaults };
  }

  if (typeof input !== 'object') {
    logger?.warn(
      `Config option "dataSystem" should be of type object, got ${typeof input}, using default value`,
    );
    return { ...defaults };
  }

  const obj = input as Record<string, unknown>;

  const initialConnectionMode =
    validateConnectionMode(obj.initialConnectionMode, 'dataSystem.initialConnectionMode', logger) ??
    defaults.initialConnectionMode;

  const backgroundConnectionMode =
    validateConnectionMode(
      obj.backgroundConnectionMode,
      'dataSystem.backgroundConnectionMode',
      logger,
    ) ?? defaults.backgroundConnectionMode;

  const automaticModeSwitching =
    validateAutomaticModeSwitching(
      obj.automaticModeSwitching,
      'dataSystem.automaticModeSwitching',
      logger,
    ) ?? defaults.automaticModeSwitching;

  return {
    initialConnectionMode,
    backgroundConnectionMode,
    automaticModeSwitching,
  };
}

export {
  BROWSER_DATA_SYSTEM_DEFAULTS,
  MOBILE_DATA_SYSTEM_DEFAULTS,
  DESKTOP_DATA_SYSTEM_DEFAULTS,
  validateDataSystemOptions,
};
