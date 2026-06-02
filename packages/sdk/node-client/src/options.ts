import {
  ConnectionMode,
  LDLogger,
  LDOptions as LDOptionsBase,
  OptionMessages,
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

export interface ValidatedOptions {
  tlsParams?: LDTLSOptions;
  enableEventCompression?: boolean;
  initialConnectionMode: ConnectionMode;
  plugins: LDPlugin[];
  localStoragePath?: string;
  hash?: string;
}

const optDefaults: ValidatedOptions = {
  tlsParams: undefined,
  enableEventCompression: undefined,
  initialConnectionMode: 'streaming',
  plugins: [],
  localStoragePath: undefined,
  hash: undefined,
};

// Keyed off ValidatedOptions so adding a Node-specific option fails to compile until a
// validator is registered here (and a default in optDefaults), forcing validation/logging
// coverage for the new field.
const validators: Record<keyof ValidatedOptions, TypeValidator> = {
  tlsParams: TypeValidators.Object,
  enableEventCompression: TypeValidators.Boolean,
  initialConnectionMode: new ConnectionModeValidator(),
  plugins: TypeValidators.createTypeArray('LDPlugin[]', {}),
  localStoragePath: TypeValidators.String,
  hash: TypeValidators.String,
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
    const [key, validator] = entry as [keyof ValidatedOptions, TypeValidator];
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

  if (output.tlsParams?.rejectUnauthorized === false) {
    logger.warn(
      'TLS certificate verification is disabled via tlsParams.rejectUnauthorized=false. ' +
        'This is insecure and should not be used in production.',
    );
  }

  return output;
}
