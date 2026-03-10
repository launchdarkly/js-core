import { LDContext } from './compat';
import { HookStage } from './CommandParams';

export interface CreateInstanceParams {
  configuration: SDKConfigParams;
  tag: string;
}

export interface SDKConfigParams {
  credential: string;
  startWaitTimeMs?: number; // UnixMillisecondTime
  initCanFail?: boolean;
  serviceEndpoints?: SDKConfigServiceEndpointsParams;
  tls?: SDKConfigTLSParams;
  streaming?: SDKConfigStreamingParams;
  polling?: SDKConfigPollingParams;
  events?: SDKConfigEventParams;
  tags?: SDKConfigTagsParams;
  clientSide?: SDKConfigClientSideParams;
  hooks?: SDKConfigHooksParams;
  wrapper?: SDKConfigWrapper;
  proxy?: SDKConfigProxyParams;
  // Server-specific config fields
  bigSegments?: SDKConfigBigSegmentsParams;
  dataSystem?: SDKDataSystemParams;
}

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

export interface SDKConfigClientSideParams {
  initialContext?: LDContext;
  initialUser?: any;
  evaluationReasons?: boolean;
  useReport?: boolean;
  includeEnvironmentAttributes?: boolean;
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

// Server-specific config types

export interface SDKConfigBigSegmentsParams {
  callbackUri: string;
  userCacheSize?: number;
  userCacheTimeMs?: number;
  statusPollIntervalMs?: number;
  staleAfterMs?: number;
}

export interface SDKDataSourceStreamingParams {
  baseUri?: string;
  initialRetryDelayMs?: number;
}

export interface SDKDataSourcePollingParams {
  baseUri?: string;
  pollIntervalMs?: number;
}

export interface SDKDataSystemSynchronizerParams {
  streaming?: SDKDataSourceStreamingParams;
  polling?: SDKDataSourcePollingParams;
}

export interface SDKDataSystemInitializerParams {
  polling?: SDKDataSourcePollingParams;
}

export interface SDKDataSystemParams {
  initializers?: SDKDataSystemInitializerParams[];
  synchronizers?: SDKDataSystemSynchronizerParams[];
  payloadFilter?: string;
}
