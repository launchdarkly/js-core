import { isNullish, LDLogger, OptionMessages, TypeValidators } from '@launchdarkly/js-sdk-common';

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
  if (isNullish(value)) {
    return undefined;
  }

  if (!TypeValidators.String.is(value)) {
    logger?.warn(OptionMessages.wrongOptionType(name, 'string', typeof value));
    return undefined;
  }

  if (!isValidFDv2ConnectionMode(value)) {
    logger?.warn(
      OptionMessages.wrongOptionType(
        name,
        'streaming | polling | offline | one-shot | background',
        String(value),
      ),
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
  if (isNullish(value)) {
    return undefined;
  }

  if (TypeValidators.Boolean.is(value)) {
    return value;
  }

  if (TypeValidators.Object.is(value)) {
    const obj = value as Record<string, unknown>;
    const result: { lifecycle?: boolean; network?: boolean } = {};

    if (!isNullish(obj.lifecycle)) {
      if (TypeValidators.Boolean.is(obj.lifecycle)) {
        result.lifecycle = obj.lifecycle;
      } else {
        logger?.warn(
          OptionMessages.wrongOptionType(`${name}.lifecycle`, 'boolean', typeof obj.lifecycle),
        );
      }
    }

    if (!isNullish(obj.network)) {
      if (TypeValidators.Boolean.is(obj.network)) {
        result.network = obj.network;
      } else {
        logger?.warn(
          OptionMessages.wrongOptionType(`${name}.network`, 'boolean', typeof obj.network),
        );
      }
    }

    return result;
  }

  logger?.warn(OptionMessages.wrongOptionType(name, 'boolean or object', typeof value));
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
  if (isNullish(input)) {
    return { ...defaults };
  }

  if (!TypeValidators.Object.is(input)) {
    logger?.warn(OptionMessages.wrongOptionType('dataSystem', 'object', typeof input));
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
