// Re-export universal exports (includes ClientPool)
export * from './index.js';

// Server-side exports
export { default as ServerSideTestHook } from './server-side/TestHook.js';
export type {
  HookData as ServerSideHookData,
  HookErrors as ServerSideHookErrors,
} from './server-side/TestHook.js';
