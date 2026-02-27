import { isNullish, LDLogger, OptionMessages, TypeValidators } from '@launchdarkly/js-sdk-common';

import type {
  AutomaticModeSwitchingConfig,
  LDClientDataSystemOptions,
  PlatformDataSystemDefaults,
} from '../api/datasource';
import validateOptions from '../configuration/validateOptions';

const connectionModeValidator = TypeValidators.oneOf(
  'streaming',
  'polling',
  'offline',
  'one-shot',
  'background',
);

// automaticModeSwitching accepts boolean | object — use a permissive validator
// so validateOptions doesn't report it as unknown; the real validation is done
// separately in validateAutomaticModeSwitching.
const booleanOrObject = {
  is: (u: unknown) =>
    typeof u === 'boolean' || (typeof u === 'object' && u !== null && !Array.isArray(u)),
  getType: () => 'boolean or object',
};

const dataSystemValidators = {
  initialConnectionMode: connectionModeValidator,
  backgroundConnectionMode: connectionModeValidator,
  automaticModeSwitching: booleanOrObject,
};

const modeSwitchingValidators = {
  lifecycle: TypeValidators.Boolean,
  network: TypeValidators.Boolean,
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

// ----------------------------- Validation --------------------------------

function validateAutomaticModeSwitching(
  value: unknown,
  name: string,
  defaultValue: boolean | AutomaticModeSwitchingConfig,
  logger?: LDLogger,
): boolean | AutomaticModeSwitchingConfig {
  if (isNullish(value)) {
    return defaultValue;
  }

  if (TypeValidators.Boolean.is(value)) {
    return value;
  }

  if (TypeValidators.Object.is(value)) {
    return validateOptions(
      value as Record<string, unknown>,
      modeSwitchingValidators,
      {},
      logger,
      name,
    ) as AutomaticModeSwitchingConfig;
  }

  logger?.warn(OptionMessages.wrongOptionType(name, 'boolean or object', typeof value));
  return defaultValue;
}

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

  const obj = input as Record<string, unknown>;
  const validated = validateOptions(
    obj,
    dataSystemValidators,
    { ...defaults },
    logger,
    'dataSystem',
  );

  validated.automaticModeSwitching = validateAutomaticModeSwitching(
    obj.automaticModeSwitching,
    'dataSystem.automaticModeSwitching',
    defaults.automaticModeSwitching,
    logger,
  );

  return validated as unknown as LDClientDataSystemOptions;
}

export {
  BROWSER_DATA_SYSTEM_DEFAULTS,
  MOBILE_DATA_SYSTEM_DEFAULTS,
  DESKTOP_DATA_SYSTEM_DEFAULTS,
  validateDataSystemOptions,
};
