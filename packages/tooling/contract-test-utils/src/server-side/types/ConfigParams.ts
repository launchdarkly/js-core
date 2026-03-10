import {
  SDKConfigEventParams,
  SDKConfigHooksParams,
  SDKConfigPollingParams,
  SDKConfigProxyParams,
  SDKConfigServiceEndpointsParams,
  SDKConfigStreamingParams,
  SDKConfigTagsParams,
  SDKConfigTLSParams,
  SDKConfigWrapper,
} from '../../types/ConfigParams.js';

// Re-export shared config types for convenience
export {
  SDKConfigTLSParams,
  SDKConfigServiceEndpointsParams,
  SDKConfigStreamingParams,
  SDKConfigPollingParams,
  SDKConfigEventParams,
  SDKConfigTagsParams,
  SDKConfigEvaluationHookData,
  SDKConfigHookInstance,
  SDKConfigHooksParams,
  SDKConfigProxyParams,
  SDKConfigWrapper,
} from '../../types/ConfigParams.js';

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
  hooks?: SDKConfigHooksParams;
  wrapper?: SDKConfigWrapper;
  proxy?: SDKConfigProxyParams;
  // Server-specific config fields
  bigSegments?: SDKConfigBigSegmentsParams;
  dataSystem?: SDKDataSystemParams;
}

export interface CreateInstanceParams {
  configuration: SDKConfigParams;
  tag: string;
}
