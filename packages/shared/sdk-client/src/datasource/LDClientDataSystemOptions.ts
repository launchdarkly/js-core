import { TypeValidators } from '@launchdarkly/js-sdk-common';

import type { PlatformDataSystemDefaults } from '../api/datasource';
import { anyOf, validatorOf } from '../configuration/validateOptions';
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

export {
  dataSystemValidators,
  BROWSER_DATA_SYSTEM_DEFAULTS,
  MOBILE_DATA_SYSTEM_DEFAULTS,
  DESKTOP_DATA_SYSTEM_DEFAULTS,
};
