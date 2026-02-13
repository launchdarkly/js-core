import {
  ConnectionMode,
  LDLogger,
  LDOptions as LDOptionsBase,
  OptionMessages,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-client-sdk-common';

import type { ElectronOptions, LDProxyOptions, LDTLSOptions } from './ElectronOptions';
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
  proxyOptions?: LDProxyOptions;
  tlsParams?: LDTLSOptions;
  enableEventCompression?: boolean;
  initialConnectionMode: ConnectionMode;
  plugins: LDPlugin[];
  enableIPC: boolean;
  useClientSideId: boolean;
}

const optDefaults: ValidatedOptions = {
  proxyOptions: undefined,
  tlsParams: undefined,
  enableEventCompression: undefined,
  initialConnectionMode: 'streaming',
  plugins: [],
  enableIPC: true,
  useClientSideId: false,
};

const validators: { [Property in keyof ElectronOptions]: TypeValidator | undefined } = {
  proxyOptions: TypeValidators.Object,
  tlsParams: TypeValidators.Object,
  enableEventCompression: TypeValidators.Boolean,
  initialConnectionMode: new ConnectionModeValidator(),
  plugins: TypeValidators.createTypeArray('LDPlugin[]', {}),
  enableIPC: TypeValidators.Boolean,
  useClientSideId: TypeValidators.Boolean,
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

  return output;
}
