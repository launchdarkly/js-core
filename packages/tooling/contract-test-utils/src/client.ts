// Re-export universal exports
export * from './index.js';

// Client-side exports
export { default as ClientSideTestHook } from './client-side/TestHook.js';
export type { Capability } from './client-side/capabilities.js';
export type { CommandableClient } from './client-side/CommandableClient.js';
export { ClientEntity } from './client-side/ClientEntity.js';
export { doCommand, badCommandError, malformedCommand } from './client-side/doCommand.js';
export { ConfigBuilder } from './client-side/ConfigBuilder.js';
export type { ConfigSection, ClientSideSdkConfig } from './client-side/ConfigBuilder.js';
export { TestHarnessWebSocketBuilder } from './client-side/TestHarnessWebSocket.js';
export type { IClientEntity } from './client-side/TestHarnessWebSocket.js';
