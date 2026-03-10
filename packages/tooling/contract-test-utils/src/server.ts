// Server-side exports
export { default as ServerSideTestHook } from './server-side/TestHook.js';
export type {
  HookData as ServerSideHookData,
  HookErrors as ServerSideHookErrors,
} from './server-side/TestHook.js';

// Re-export shared utilities that don't depend on client-side packages
export { ClientPool } from './server-side/ClientPool.js';

// Re-export shared types for server consumers that use node16 moduleResolution
// (they cannot import from the '.' subpath which serves extensionless .ts source)
export type {
  CreateInstanceParams,
  SDKConfigParams,
  SDKConfigStreamingParams,
  SDKConfigPollingParams,
  SDKConfigEventParams,
  SDKConfigTagsParams,
  SDKConfigHooksParams,
  SDKConfigHookInstance,
  SDKConfigWrapper,
  SDKConfigServiceEndpointsParams,
  SDKConfigTLSParams,
  SDKConfigProxyParams,
} from './types/ConfigParams.js';
