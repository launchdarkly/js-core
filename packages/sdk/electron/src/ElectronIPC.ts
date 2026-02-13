import { LDEmitterEventName } from '@launchdarkly/js-client-sdk-common';

/**
 * Synchronous IPC channel names and helpers for type-safe main/renderer communication.
 */
type IPCSyncChannel =
  | 'addEventHandler'
  | 'removeEventHandler'
  | 'allFlags'
  | 'boolVariation'
  | 'boolVariationDetail'
  | 'getContext'
  | 'jsonVariation'
  | 'jsonVariationDetail'
  | 'numberVariation'
  | 'numberVariationDetail'
  | 'stringVariation'
  | 'stringVariationDetail'
  | 'track'
  | 'variation'
  | 'variationDetail'
  | 'getConnectionMode'
  | 'isOffline';

/**
 * Asynchronous IPC channel names and helpers for type-safe main/renderer communication.
 */
type IPCAsyncChannel = 'waitForInitialization' | 'flush' | 'identify' | 'setConnectionMode';

export const AllSyncChannels: readonly IPCSyncChannel[] = [
  'addEventHandler',
  'removeEventHandler',
  'allFlags',
  'boolVariation',
  'boolVariationDetail',
  'getContext',
  'jsonVariation',
  'jsonVariationDetail',
  'numberVariation',
  'numberVariationDetail',
  'stringVariation',
  'stringVariationDetail',
  'track',
  'variation',
  'variationDetail',
  'getConnectionMode',
  'isOffline',
];

/**
 * All asynchronous IPC channel names.
 */
export const AllAsyncChannels: readonly IPCAsyncChannel[] = [
  'waitForInitialization',
  'flush',
  'identify',
  'setConnectionMode',
];

/**
 * All IPC channel base names.
 */
export type IPCChannel = IPCSyncChannel | IPCAsyncChannel;

/**
 * Interface for IPC event handlers.
 */
export interface IpcEventHandler {
  port: Electron.MessagePortMain;
  eventName: LDEmitterEventName;
  callback: (...args: any[]) => void;
}

/**
 * Returns the full IPC channel name for the given namespace and channel base name.
 */
export function getIPCChannelName(namespace: string, channel: IPCChannel): string {
  return `ld:${namespace}:${channel}`;
}
