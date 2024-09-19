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
  LDSingleKindContext,
} from '@launchdarkly/js-client-sdk-common';

// The exported LDClient and LDOptions are the browser specific implementations.
// These shadow the common implementations.
import { BrowserClient, LDClient } from './BrowserClient';
import { BrowserOptions as LDOptions } from './options';

// TODO: Export and use browser specific options.
export {
  LDClient,
  LDFlagSet,
  LDContext,
  LDContextCommon,
  LDContextMeta,
  LDMultiKindContext,
  LDSingleKindContext,
  LDLogLevel,
  LDLogger,
  LDOptions,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDEvaluationReason,
};

export function init(clientSideId: string, options?: LDOptions): LDClient {
  // AutoEnvAttributes are not supported yet in the browser SDK.
  return new BrowserClient(clientSideId, AutoEnvAttributes.Disabled, options);
}
