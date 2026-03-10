// Server-side exports
export { default as ServerSideTestHook } from './server-side/TestHook.js';
export type {
  HookData as ServerSideHookData,
  HookErrors as ServerSideHookErrors,
} from './server-side/TestHook.js';

// Re-export shared utilities
export { ClientPool } from './server-side/ClientPool.js';

// Re-export shared base types (no SDK dependency)
export * from './types/CommandParams.js';
export * from './types/ConfigParams.js';

// Re-export server-specific types (uses @launchdarkly/js-server-sdk-common)
export * from './server-side/types/CommandParams.js';
export * from './server-side/types/ConfigParams.js';
