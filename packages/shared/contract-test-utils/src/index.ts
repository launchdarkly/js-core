// Universal exports (no SDK dependency)
export * from './types/CommandParams.js';
export {
  type CreateInstanceParams,
  type SDKConfigParams,
  type SDKConfigTLSParams,
  type SDKConfigServiceEndpointsParams,
  type SDKConfigStreamingParams,
  type SDKConfigPollingParams,
  type SDKConfigEventParams,
  type SDKConfigTagsParams,
  type SDKConfigClientSideParams,
  type SDKConfigEvaluationHookData,
  type SDKConfigHookInstance,
  type SDKConfigHooksParams,
  type SDKConfigWrapper,
  type HookStage as ConfigHookStage,
} from './types/ConfigParams.js';
export { makeLogger } from './logging/makeLogger.js';

// Client-side exports
export { default as ClientSideTestHook } from './client-side/TestHook.js';
export type {
  HookData as ClientSideHookData,
  HookErrors as ClientSideHookErrors,
} from './client-side/TestHook.js';
export { default as TestHarnessWebSocket } from './client-side/TestHarnessWebSocket.js';
export type { ClientEntity, CreateClientEntityFn } from './client-side/TestHarnessWebSocket.js';

// Server-side exports
export { default as ServerSideTestHook } from './server-side/TestHook.js';
export type {
  HookData as ServerSideHookData,
  HookErrors as ServerSideHookErrors,
} from './server-side/TestHook.js';
export { ClientPool } from './server-side/ClientPool.js';
