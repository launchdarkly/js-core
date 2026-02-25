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
 * Per-event state for the broadcast pattern: one SDK listener per event name
 * that forwards to all renderer ports subscribed to that event.
 */
export interface IpcEventSubscription {
  broadcastCallback: (...args: any[]) => void;
  ports: Map<string, Electron.MessagePortMain>;
}

export interface IpcEventCallback {
  callbackId: string;
  eventName: LDEmitterEventName;
}

/**
 * Returns the full IPC channel name for the given namespace and channel base name.
 */
export function getIPCChannelName(namespace: string, channel: IPCChannel): string {
  return `ld:${namespace}:${channel}`;
}
