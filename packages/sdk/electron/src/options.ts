import {
  ConnectionMode,
  LDLogger,
  LDOptions as LDOptionsBase,
  OptionMessages,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-client-sdk-common';

import type { ElectronOptions, LDElectronStorage } from './ElectronOptions';
import type { LDPlugin } from './LDPlugin';

class ConnectionModeValidator implements TypeValidator {
  is(u: unknown): u is ConnectionMode {
    return u === 'offline' || u === 'streaming' || u === 'polling';
  }
  getType(): string {
    return 'ConnectionMode (offline | streaming | polling)';
  }
}

class StorageOptionsValidator implements TypeValidator {
  is(u: unknown): u is LDElectronStorage {
    if (typeof u !== 'object' || u === null) {
      return false;
    }
    const has = (k: string) => typeof (u as Record<string, unknown>)[k] === 'function';
    return has('get') && has('set') && has('clear');
  }
  getType(): string {
    return 'LDElectronStorage ({ get, set, clear })';
  }
}

export interface ValidatedOptions {
  enableEventCompression?: boolean;
  initialConnectionMode: ConnectionMode;
  plugins: LDPlugin[];
  enableIPC: boolean;
  useClientSideId: boolean;
  namespace?: string;
  storage?: LDElectronStorage;
  encryptStorage?: boolean;
  hash?: string;
  wrapperName?: string;
  wrapperVersion?: string;
}

const optDefaults: ValidatedOptions = {
  enableEventCompression: undefined,
  initialConnectionMode: 'streaming',
  plugins: [],
  enableIPC: true,
  useClientSideId: false,
  namespace: undefined,
  storage: undefined,
  encryptStorage: false,
  hash: undefined,
  wrapperName: undefined,
  wrapperVersion: undefined,
};

const validators: { [Property in keyof ElectronOptions]: TypeValidator | undefined } = {
  enableEventCompression: TypeValidators.Boolean,
  initialConnectionMode: new ConnectionModeValidator(),
  plugins: TypeValidators.createTypeArray('LDPlugin[]', {}),
  enableIPC: TypeValidators.Boolean,
  useClientSideId: TypeValidators.Boolean,
  namespace: TypeValidators.String,
  storage: new StorageOptionsValidator(),
  encryptStorage: TypeValidators.Boolean,
  hash: TypeValidators.String,
  wrapperName: TypeValidators.String,
  wrapperVersion: TypeValidators.String,
};

export function filterToBaseOptions(opts: ElectronOptions): LDOptionsBase {
  const baseOptions: LDOptionsBase = { ...opts };

  // Remove any Electron specific configuration keys so we don't get warnings from
  // the base implementation for unknown configuration.
  Object.keys(optDefaults).forEach((key) => {
    delete (baseOptions as any)[key];
  });
  return baseOptions;
}

export default function validateOptions(opts: ElectronOptions, logger: LDLogger): ValidatedOptions {
  const output: ValidatedOptions = { ...optDefaults };

  Object.entries(validators).forEach((entry) => {
    const [key, validator] = entry as [keyof ElectronOptions, TypeValidator];
    const value = opts[key];
    if (value !== undefined) {
      if (validator.is(value)) {
        // @ts-ignore The type inference has some problems here.
        output[key as keyof ValidatedOptions] = value as any;
      } else {
        logger.warn(OptionMessages.wrongOptionType(key, validator.getType(), typeof value));
      }
    }
  });

  if (output.hash !== undefined && !output.useClientSideId) {
    throw new Error(
      'Invalid configuration: secure mode "hash" is not supported when "useClientSideId" is ' +
        'false. Remove "hash" or set "useClientSideId" to true.',
    );
  }

  const dataSystemConfigured =
    typeof opts.dataSystem === 'object' &&
    opts.dataSystem !== null &&
    !Array.isArray(opts.dataSystem);
  if (
    dataSystemConfigured &&
    opts.initialConnectionMode !== undefined &&
    opts.initialConnectionMode !== null
  ) {
    logger.warn(
      'Both "dataSystem" and "initialConnectionMode" are set. "initialConnectionMode" applies ' +
        'only when the FDv2 data system is not configured and will be ignored. Use ' +
        '"dataSystem.automaticModeSwitching.initialConnectionMode" (with automaticModeSwitching.type ' +
        'set to "manual") to set the initial connection mode for the FDv2 data system.',
    );
  }

  if (output.storage !== undefined && output.encryptStorage) {
    logger.warn(
      'Config option "encryptStorage" has no effect when a custom "storage" is provided.',
    );
  }

  return output;
}
