import type { MessagePortMain } from 'electron';

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
  | 'log'
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
  ports: Map<string, MessagePortMain>;
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

/**
 * Derives an IPC namespace from a credential and an optional user-provided namespace.
 */
export function deriveNamespace(credential: string, customNamespace?: string): string {
  return customNamespace ? `${customNamespace}_${credential}` : credential;
}

// Namespaces that currently own ipcMain handlers. Electron rejects a second ipcMain.handle on
// the same channel, so a second client on the same namespace is rejected here, before it builds
// anything.
const activeNamespaces = new Set<string>();

/**
 * Throws when another client already owns the namespace. Does not claim it.
 */
export function assertNamespaceAvailable(namespace: string): void {
  if (activeNamespaces.has(namespace)) {
    throw new Error(
      `IPC namespace "${namespace}" is already in use by another LaunchDarkly client. Close that ` +
        'client first, or give each client that shares a credential a unique "namespace" option.',
    );
  }
}

/**
 * Marks the namespace as owned by a client. Throws when the namespace is in use.
 */
export function claimNamespace(namespace: string): void {
  assertNamespaceAvailable(namespace);
  activeNamespaces.add(namespace);
}

/**
 * Frees the namespace so a later client can claim it. Releasing an unclaimed namespace is a no-op.
 */
export function releaseNamespace(namespace: string): void {
  activeNamespaces.delete(namespace);
}
