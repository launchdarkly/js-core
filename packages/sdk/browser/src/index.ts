import {
  AutoEnvAttributes,
  LDContext,
  LDContextCommon,
  LDContextMeta,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDEvaluationReason,
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
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDEvaluationReason,
};

export function init(
  clientSideId: string,
  autoEnvAttributes: AutoEnvAttributes,
  options?: LDOptions,
): LDClient {
  return new BrowserClient(clientSideId, autoEnvAttributes, options);
}
