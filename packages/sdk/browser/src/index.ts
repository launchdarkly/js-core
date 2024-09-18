import {
  AutoEnvAttributes,
  LDContext,
  LDContextCommon,
  LDContextMeta,
  LDFlagSet,
  LDLogger,
  LDLogLevel,
  LDMultiKindContext,
  LDSingleKindContext,
} from '@launchdarkly/js-client-sdk-common';

// The exported LDClient and LDOptions are the browser specific implementations.
// These shadow the common implementations.
import { BrowserClient, LDClient } from './BrowserClient';
import { BrowserOptions as LDOptions } from './options';

// TODO: Export and use browser specific options.
export {
  LDClient,
  AutoEnvAttributes,
  LDFlagSet,
  LDContext,
  LDContextCommon,
  LDContextMeta,
  LDMultiKindContext,
  LDSingleKindContext,
  LDLogLevel,
  LDLogger,
  LDOptions,
};

export function init(
  clientSideId: string,
  autoEnvAttributes: AutoEnvAttributes,
  options?: LDOptions,
): LDClient {
  return new BrowserClient(clientSideId, autoEnvAttributes, options);
}
