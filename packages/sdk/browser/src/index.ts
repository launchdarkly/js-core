import {
  AutoEnvAttributes,
  LDContext,
  LDContextCommon,
  LDContextMeta,
  LDFlagSet,
  LDLogger,
  LDLogLevel,
  LDMultiKindContext,
  LDOptions,
  LDSingleKindContext,
} from '@launchdarkly/js-client-sdk-common';

import { BrowserClient, LDClient } from './BrowserClient';

// TODO: Export and use browser specific options.
export {
  LDClient,
  AutoEnvAttributes,
  LDOptions,
  LDFlagSet,
  LDContext,
  LDContextCommon,
  LDContextMeta,
  LDMultiKindContext,
  LDSingleKindContext,
  LDLogLevel,
  LDLogger,
};

export function init(
  clientSideId: string,
  autoEnvAttributes: AutoEnvAttributes,
  options?: LDOptions,
): LDClient {
  return new BrowserClient(clientSideId, autoEnvAttributes, options);
}
