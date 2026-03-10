// Shared config types with no SDK-specific dependencies.
// SDK-specific types (those referencing LDContext) are in
// client-side/types/ConfigParams.ts and server-side/types/ConfigParams.ts.

import { HookStage } from './CommandParams';

export interface SDKConfigTLSParams {
  skipVerifyPeer?: boolean;
  customCAFile?: string;
}

export interface SDKConfigServiceEndpointsParams {
  streaming?: string;
  polling?: string;
  events?: string;
}

export interface SDKConfigStreamingParams {
  baseUri?: string;
  initialRetryDelayMs?: number; // UnixMillisecondTime
  filter?: string;
}

export interface SDKConfigPollingParams {
  baseUri?: string;
  pollIntervalMs?: number; // UnixMillisecondTime
  filter?: string;
}

export interface SDKConfigEventParams {
  baseUri?: string;
  capacity?: number;
  enableDiagnostics: boolean;
  allAttributesPrivate?: boolean;
  globalPrivateAttributes?: string[];
  flushIntervalMs?: number; // UnixMillisecondTime
  omitAnonymousContexts?: boolean;
  enableGzip?: boolean;
}

export interface SDKConfigTagsParams {
  applicationId?: string;
  applicationVersion?: string;
}

export interface SDKConfigEvaluationHookData {
  [key: string]: unknown;
}

export interface SDKConfigHookInstance {
  name: string;
  callbackUri: string;
  data?: Record<HookStage, SDKConfigEvaluationHookData>;
  errors?: Record<HookStage, string>;
}

export interface SDKConfigHooksParams {
  hooks: SDKConfigHookInstance[];
}

export interface SDKConfigProxyParams {
  httpProxy?: string;
}

export interface SDKConfigWrapper {
  name: string;
  version: string;
}
