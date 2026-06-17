import {
  ConnectionMode,
  LDLogger,
  LDOptions as LDOptionsBase,
  OptionMessages,
  Storage,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-client-sdk-common';

import type { LDTLSOptions, NodeOptions } from './NodeOptions';
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
  is(u: unknown): u is Storage {
    if (typeof u !== 'object' || u === null) {
      return false;
    }
    const has = (k: string) =>
      Object.prototype.hasOwnProperty.call(u, k) &&
      typeof (u as Record<string, unknown>)[k] === 'function';
    return has('get') && has('set') && has('clear');
  }
  getType(): string {
    return 'Storage ({ get, set, clear })';
  }
}

export interface ValidatedOptions {
  tlsParams?: LDTLSOptions;
  enableEventCompression?: boolean;
  initialConnectionMode: ConnectionMode;
  plugins: LDPlugin[];
  localStoragePath?: string;
  storage?: Storage;
  hash?: string;
  useMobileKey: boolean;
  wrapperName?: string;
  wrapperVersion?: string;
}

const optDefaults: ValidatedOptions = {
  tlsParams: undefined,
  enableEventCompression: undefined,
  initialConnectionMode: 'streaming',
  plugins: [],
  localStoragePath: undefined,
  storage: undefined,
  hash: undefined,
  useMobileKey: false,
  wrapperName: undefined,
  wrapperVersion: undefined,
};

const validators: { [Property in keyof NodeOptions]: TypeValidator | undefined } = {
  tlsParams: TypeValidators.Object,
  enableEventCompression: TypeValidators.Boolean,
  initialConnectionMode: new ConnectionModeValidator(),
  plugins: TypeValidators.createTypeArray('LDPlugin[]', {}),
  localStoragePath: TypeValidators.String,
  storage: new StorageOptionsValidator(),
  hash: TypeValidators.String,
  useMobileKey: TypeValidators.Boolean,
  wrapperName: TypeValidators.String,
  wrapperVersion: TypeValidators.String,
};

export function filterToBaseOptions(opts: NodeOptions): LDOptionsBase {
  const baseOptions: LDOptionsBase = { ...opts };

  // Strip Node-specific keys so the common options validator does not warn about them.
  Object.keys(optDefaults).forEach((key) => {
    delete (baseOptions as any)[key];
  });
  return baseOptions;
}

export default function validateOptions(opts: NodeOptions, logger: LDLogger): ValidatedOptions {
  const output: ValidatedOptions = { ...optDefaults };

  Object.entries(validators).forEach((entry) => {
    const [key, validator] = entry as [keyof NodeOptions, TypeValidator | undefined];
    if (!validator) {
      return;
    }
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

  if (output.useMobileKey && output.hash !== undefined) {
    throw new Error(
      'Invalid configuration: secure mode "hash" is not supported when "useMobileKey" is true. ' +
        'Remove one of these options.',
    );
  }

  if (output.localStoragePath !== undefined && output.storage !== undefined) {
    logger.warn(
      'Both "localStoragePath" and "storage" are set. ' +
        '"localStoragePath" will be ignored in favor of the custom "storage" implementation.',
    );
  }

  if (output.tlsParams?.rejectUnauthorized === false) {
    logger.warn(
      'TLS certificate verification is disabled via tlsParams.rejectUnauthorized=false. ' +
        'This is insecure and should not be used in production.',
    );
  }

  return output;
}
