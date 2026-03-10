import { LDContext } from '@launchdarkly/js-client-sdk-common';

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
} from '../../types/ConfigParams';

// Re-export shared config types for convenience
export type {
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
} from '../../types/ConfigParams';

export interface SDKConfigClientSideParams {
  initialContext?: LDContext;
  initialUser?: any;
  evaluationReasons?: boolean;
  useReport?: boolean;
  includeEnvironmentAttributes?: boolean;
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
}

export interface CreateInstanceParams {
  configuration: SDKConfigParams;
  tag: string;
}
