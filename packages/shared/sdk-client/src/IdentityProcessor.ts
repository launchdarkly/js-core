import { Context, LDContext, LDLogger } from '@launchdarkly/js-sdk-common';
import { LDStreamProcessor } from '@launchdarkly/js-sdk-common/dist/api/subsystem';

import ConnectionMode from './api/ConnectionMode';
import DefaultFlagManager from './flag-manager/FlagManager';

export type IdentifyProcessor = (params: {
  waitForNetworkResults: boolean;
  isOffline: () => boolean;
  getConnectionMode: () => ConnectionMode;
  logger: LDLogger;
  updateProcessor: LDStreamProcessor | undefined;
  createStreamingProcessor: (
    context: LDContext,
    checkedContext: Context,
    identifyResolve: any,
    identifyReject: any,
  ) => void;
  createPollingProcessor: (
    context: LDContext,
    checkedContext: Context,
    identifyResolve: any,
    identifyReject: any,
  ) => void;
  context: LDContext;
  checkedContext: Context;
  identifyResolve: () => void;
  identifyReject: (error: any) => void;
  flagManager: DefaultFlagManager;
}) => Promise<void>;
