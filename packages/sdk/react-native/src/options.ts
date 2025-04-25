import {
  ConnectionMode,
  LDLogger,
  LDOptions,
  OptionMessages,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-client-sdk-common';

import { LDPlugin } from './LDPlugin';
import RNOptions, { RNStorage } from './RNOptions';

class ConnectionModeValidator implements TypeValidator {
  is(u: unknown): u is ConnectionMode {
    return u === 'offline' || u === 'streaming' || u === 'polling';
  }
  getType(): string {
    return 'ConnectionMode (offline | streaming | polling)';
  }
}

export interface ValidatedOptions {
  runInBackground: boolean;
  automaticNetworkHandling: boolean;
  automaticBackgroundHandling: boolean;
  storage?: RNStorage;
  initialConnectionMode: ConnectionMode;
  plugins: LDPlugin[];
}

const optDefaults: ValidatedOptions = {
  runInBackground: false,
  automaticNetworkHandling: true,
  automaticBackgroundHandling: true,
  storage: undefined,
  initialConnectionMode: 'streaming',
  plugins: [],
};

const validators: { [Property in keyof RNOptions]: TypeValidator | undefined } = {
  runInBackground: TypeValidators.Boolean,
  automaticNetworkHandling: TypeValidators.Boolean,
  automaticBackgroundHandling: TypeValidators.Boolean,
  storage: TypeValidators.Object,
  initialConnectionMode: new ConnectionModeValidator(),
  plugins: TypeValidators.createTypeArray('LDPlugin[]', {}),
};

export function filterToBaseOptions(opts: RNOptions): LDOptions {
  const baseOptions: LDOptions = { ...opts };

  // Remove any RN specific configuration keys so we don't get warnings from
  // the base implementation for unknown configuration.
  Object.keys(optDefaults).forEach((key) => {
    delete (baseOptions as any)[key];
  });
  return baseOptions;
}

export default function validateOptions(opts: RNOptions, logger: LDLogger): ValidatedOptions {
  const output: ValidatedOptions = { ...optDefaults };

  Object.entries(validators).forEach((entry) => {
    const [key, validator] = entry as [keyof RNOptions, TypeValidator];
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

  return output;
}
