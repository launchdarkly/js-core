import { isNullish, LDLogger, OptionMessages, TypeValidators } from '@launchdarkly/js-sdk-common';

import type { LDClientDataSystemOptions, PlatformDataSystemDefaults } from '../api/datasource';
import validateOptions, { anyOf, validatorOf } from '../configuration/validateOptions';
import { connectionModeValidator } from './ConnectionModeConfig';

const modeSwitchingValidators = {
  lifecycle: TypeValidators.Boolean,
  network: TypeValidators.Boolean,
};

const dataSystemValidators = {
  initialConnectionMode: connectionModeValidator,
  backgroundConnectionMode: connectionModeValidator,
  automaticModeSwitching: anyOf(TypeValidators.Boolean, validatorOf(modeSwitchingValidators)),
};

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

/**
 * Validates a user-provided LDClientDataSystemOptions, logging warnings for
 * any invalid values and replacing them with defaults from the given platform
 * defaults.
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

  return validateOptions(
    input as Record<string, unknown>,
    dataSystemValidators,
    { ...defaults },
    logger,
    'dataSystem',
  ) as unknown as LDClientDataSystemOptions;
}

export {
  BROWSER_DATA_SYSTEM_DEFAULTS,
  MOBILE_DATA_SYSTEM_DEFAULTS,
  DESKTOP_DATA_SYSTEM_DEFAULTS,
  validateDataSystemOptions,
};
