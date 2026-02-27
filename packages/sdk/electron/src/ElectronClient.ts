import path from 'node:path';

import { app, ipcMain } from 'electron';
import type { IpcMainEvent, MessagePortMain } from 'electron';

import { basicLogger, createClient as createBaseClient } from '@launchdarkly/node-client-sdk';
import type { LDContext } from '@launchdarkly/node-client-sdk';

import {
  AllAsyncChannels,
  AllSyncChannels,
  deriveNamespace,
  getIPCChannelName,
  IpcEventCallback,
  IpcEventSubscription,
} from './ElectronIPC';
import type { ElectronOptions } from './ElectronOptions';
import type { LDClient } from './LDClient';
import { validateAndMapOptions } from './options';

const VALID_LOG_LEVELS: ReadonlySet<string> = new Set(['error', 'warn', 'info', 'debug']);

/**
 * Builds the LaunchDarkly client for the Electron main process by composing over
 * `@launchdarkly/node-client-sdk`'s client facade (mirrors the react-sdk wrapping pattern).
 */
export function makeClient(
  credential: string,
  initialContext: LDContext,
  options: ElectronOptions = {},
): LDClient {
  const logger = options.logger ?? basicLogger({ level: options.debug ? 'debug' : 'info' });
  const { nodeOptions, electron } = validateAndMapOptions(options, logger);
  nodeOptions.logger = logger;

  // Compute a sensible default on-disk cache location under Electron's userData directory when the
  // caller has not provided their own storage. Node's file storage writes `ldcache.json` inside
  // this directory. `app.getPath` throws if the app is not ready (including under Node/jest), so
  // fall back to the node-client-sdk default in that case.
  if (nodeOptions.storage === undefined && nodeOptions.localStoragePath === undefined) {
    try {
      nodeOptions.localStoragePath = path.join(app.getPath('userData'), 'ldcache');
    } catch (err) {
      logger.debug(
        `Unable to determine a default Electron storage path; falling back to the node-client-sdk default. Reason: ${err}`,
      );
    }
  }

  const baseClient = createBaseClient(credential, initialContext, nodeOptions);

  // IPC subscription state (closure variables, populated only when IPC is enabled).
  let ipcNamespace: string | undefined;
  let ipcEventSubscriptions: Map<string, IpcEventSubscription> | undefined;
  // reverse lookup table to make removals faster
  let ipcCallbackIdToEventName: Map<string, string> | undefined;
  // queue to serialize add/remove so subscription map updates run in order
  let ipcSubscriptionQueue:
    | Array<
        | { type: 'add'; event: IpcMainEvent; messageData: IpcEventCallback }
        | { type: 'remove'; event: IpcMainEvent; callbackId: string }
      >
    | undefined;

  function applyAdd(event: IpcMainEvent, messageData: IpcEventCallback): void {
    const { callbackId, eventName } = messageData;
    const [port] = event.ports;
    if (!port) {
      return;
    }
    let entry = ipcEventSubscriptions!.get(eventName);
    if (!entry) {
      const ports = new Map<string, MessagePortMain>();
      const broadcastCallback = (...args: unknown[]) => {
        ports.forEach((p) => {
          try {
            p.postMessage(args);
          } catch {
            baseClient.logger.warn(`Event ${eventName} broadcast failed`);
          }
        });
      };
      baseClient.on(eventName, broadcastCallback);
      entry = { broadcastCallback, ports };
      ipcEventSubscriptions!.set(eventName, entry);
    }
    entry.ports.set(callbackId, port);
    ipcCallbackIdToEventName!.set(callbackId, eventName);
  }

  function applyRemove(event: IpcMainEvent, callbackId: string): void {
    const eventName = ipcCallbackIdToEventName!.get(callbackId);
    if (!eventName) {
      event.returnValue = false;
      return;
    }
    const entry = ipcEventSubscriptions!.get(eventName);
    const port = entry?.ports.get(callbackId);
    if (!entry || !port) {
      event.returnValue = false;
      return;
    }
    entry.ports.delete(callbackId);
    ipcCallbackIdToEventName!.delete(callbackId);
    port.close();
    if (entry.ports.size === 0) {
      baseClient.off(eventName, entry.broadcastCallback);
      ipcEventSubscriptions!.delete(eventName);
    }
    event.returnValue = true;
  }

  /**
   * Runs the subscription queue in order so add/remove operations updating the subscription maps
   * are serialized and never interleaved.
   */
  function processSubscriptionQueue(): void {
    const queue = ipcSubscriptionQueue!;
    while (queue.length > 0) {
      const op = queue.shift()!;
      if (op.type === 'add') {
        applyAdd(op.event, op.messageData);
      } else {
        applyRemove(op.event, op.callbackId);
      }
    }
  }

  function openIPCChannels(namespace: string): void {
    ipcNamespace = namespace;
    ipcEventSubscriptions = new Map<string, IpcEventSubscription>();
    ipcCallbackIdToEventName = new Map<string, string>();
    ipcSubscriptionQueue = [];

    ipcMain.on(
      getIPCChannelName(namespace, 'addEventHandler'),
      (event: IpcMainEvent, messageData: IpcEventCallback) => {
        ipcSubscriptionQueue!.push({ type: 'add', event, messageData });
        processSubscriptionQueue();
      },
    );

    ipcMain.on(
      getIPCChannelName(namespace, 'removeEventHandler'),
      (event: IpcMainEvent, callbackId: string) => {
        ipcSubscriptionQueue!.push({ type: 'remove', event, callbackId });
        processSubscriptionQueue();
      },
    );

    ipcMain.handle(getIPCChannelName(namespace, 'waitForInitialization'), (_event, waitOptions) =>
      baseClient.waitForInitialization(waitOptions),
    );

    ipcMain.on(getIPCChannelName(namespace, 'allFlags'), (event) => {
      event.returnValue = baseClient.allFlags();
    });

    ipcMain.on(getIPCChannelName(namespace, 'boolVariation'), (event, key, defaultValue) => {
      event.returnValue = baseClient.boolVariation(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'boolVariationDetail'), (event, key, defaultValue) => {
      event.returnValue = baseClient.boolVariationDetail(key, defaultValue);
    });

    ipcMain.handle(getIPCChannelName(namespace, 'flush'), (_event) => baseClient.flush());

    ipcMain.on(getIPCChannelName(namespace, 'getContext'), (event) => {
      event.returnValue = baseClient.getContext();
    });

    ipcMain.handle(getIPCChannelName(namespace, 'identify'), (_event, context, identifyOptions) =>
      baseClient.identify(context, identifyOptions),
    );

    ipcMain.on(getIPCChannelName(namespace, 'log'), (_event, level: string, message: string) => {
      if (VALID_LOG_LEVELS.has(level)) {
        (baseClient.logger[level as 'error' | 'warn' | 'info' | 'debug'] as (m: string) => void)(
          message,
        );
      }
    });

    ipcMain.on(getIPCChannelName(namespace, 'jsonVariation'), (event, key, defaultValue) => {
      event.returnValue = baseClient.jsonVariation(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'jsonVariationDetail'), (event, key, defaultValue) => {
      event.returnValue = baseClient.jsonVariationDetail(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'numberVariation'), (event, key, defaultValue) => {
      event.returnValue = baseClient.numberVariation(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'numberVariationDetail'), (event, key, defaultValue) => {
      event.returnValue = baseClient.numberVariationDetail(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'stringVariation'), (event, key, defaultValue) => {
      event.returnValue = baseClient.stringVariation(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'stringVariationDetail'), (event, key, defaultValue) => {
      event.returnValue = baseClient.stringVariationDetail(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'track'), (event, key, data, metricValue) => {
      event.returnValue = baseClient.track(key, data, metricValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'variation'), (event, key, defaultValue) => {
      event.returnValue = baseClient.variation(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'variationDetail'), (event, key, defaultValue) => {
      event.returnValue = baseClient.variationDetail(key, defaultValue);
    });

    ipcMain.handle(getIPCChannelName(namespace, 'setConnectionMode'), (_event, mode) =>
      baseClient.setConnectionMode(mode),
    );

    ipcMain.on(getIPCChannelName(namespace, 'getConnectionMode'), (event) => {
      event.returnValue = baseClient.getConnectionMode();
    });

    ipcMain.on(getIPCChannelName(namespace, 'isOffline'), (event) => {
      event.returnValue = baseClient.isOffline();
    });
  }

  function closeIPCChannels(): void {
    if (!ipcNamespace) {
      return;
    }

    if (ipcEventSubscriptions) {
      ipcEventSubscriptions.forEach((entry, eventName) => {
        baseClient.off(eventName, entry.broadcastCallback);
        entry.ports.forEach((port) => port.close());
      });
      ipcEventSubscriptions.clear();
    }
    ipcCallbackIdToEventName?.clear();

    AllSyncChannels.forEach((channel) => {
      ipcMain.removeAllListeners(getIPCChannelName(ipcNamespace!, channel));
    });
    AllAsyncChannels.forEach((channel) => {
      ipcMain.removeHandler(getIPCChannelName(ipcNamespace!, channel));
    });

    ipcEventSubscriptions = undefined;
    ipcCallbackIdToEventName = undefined;
    ipcSubscriptionQueue = undefined;
    ipcNamespace = undefined;
  }

  if (electron.enableIPC) {
    openIPCChannels(deriveNamespace(credential, electron.namespace));
  }

  // Spread the base client rather than wrapping it in a class: node-client-sdk's client is a
  // plain object, and this only needs to override close(). Spreading means every other method
  // stays in sync automatically as node-client-sdk's surface grows, with no pass-through list to
  // maintain here.
  return {
    ...baseClient,
    close: async (): Promise<void> => {
      closeIPCChannels();
      await baseClient.close();
    },
  };
}
