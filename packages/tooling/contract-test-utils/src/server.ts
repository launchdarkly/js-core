// Server-side exports
export { default as ServerSideTestHook } from './server-side/TestHook.js';
export type {
  HookData as ServerSideHookData,
  HookErrors as ServerSideHookErrors,
} from './server-side/TestHook.js';

// Re-export shared utilities
export { ClientPool } from './server-side/ClientPool.js';
export { makeLogger } from './logging/makeLogger.js';

// Re-export all types (uses minimal compat types, no SDK dependency)
export * from './types/CommandParams.js';
export * from './types/ConfigParams.js';
