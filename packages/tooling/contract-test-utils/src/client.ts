// Re-export universal exports
export * from './index.js';

// Client-side exports
export { default as ClientSideTestHook } from './client-side/TestHook.js';
export { CLIENT_SIDE_CAPABILITIES } from './client-side/capabilities.js';
export type { Capability } from './client-side/capabilities.js';
export type { CommandableClient } from './client-side/CommandableClient.js';
export { ClientEntity } from './client-side/ClientEntity.js';
export { doCommand, badCommandError, malformedCommand } from './client-side/doCommand.js';
export { makeSdkConfig, makeDefaultInitialContext } from './client-side/makeSdkConfig.js';
export type { ClientSideSdkConfig } from './client-side/makeSdkConfig.js';
export { TestHarnessWebSocketBuilder } from './client-side/TestHarnessWebSocket.js';
export type { IClientEntity } from './client-side/TestHarnessWebSocket.js';
