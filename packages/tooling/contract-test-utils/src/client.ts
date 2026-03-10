// Re-export shared base types (no SDK dependency)
export * from './types/CommandParams';
export * from './types/ConfigParams';

// Re-export client-specific types (uses @launchdarkly/js-client-sdk-common)
export * from './client-side/types/CommandParams';
export * from './client-side/types/ConfigParams';

// Re-export shared utilities
export { makeLogger } from './logging/makeLogger';
export { ClientPool } from './server-side/ClientPool';

// Client-side exports
export { default as ClientSideTestHook } from './client-side/TestHook';
export type {
  HookData as ClientSideHookData,
  HookErrors as ClientSideHookErrors,
} from './client-side/TestHook';
