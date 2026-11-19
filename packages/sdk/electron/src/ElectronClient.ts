import { ipcMain } from 'electron';
import type { IpcMainEvent, MessagePortMain } from 'electron';

import {
  AutoEnvAttributes,
  BasicLogger,
  browserFdv1Endpoints,
  Configuration,
  ConnectionMode,
  FlagManager,
  internal,
  LDClientImpl,
  LDClientInternalOptions,
  LDContext,
  LDEmitter,
  LDEmitterEventName,
  LDFlagValue,
  LDHeaders,
  LDIdentifyResult,
  LDLogger,
  LDPluginEnvironmentMetadata,
  LDWaitForInitializationOptions,
  LDWaitForInitializationResult,
  mobileFdv1Endpoints,
  safeRegisterDebugOverridePlugins,
} from '@launchdarkly/js-client-sdk-common';

import ElectronDataManager from './ElectronDataManager';
import type { ElectronIdentifyOptions } from './ElectronIdentifyOptions';
import {
  assertNamespaceAvailable,
  claimNamespace,
  deriveNamespace,
  getIPCChannelName,
  IpcEventCallback,
  IpcEventSubscription,
  releaseNamespace,
} from './ElectronIPC';
import type { ElectronOptions } from './ElectronOptions';
import type { LDClient, LDStartOptions } from './LDClient';
import type { LDPlugin } from './LDPlugin';
import validateOptions, { filterToBaseOptions } from './options';
import ElectronPlatform from './platform/ElectronPlatform';

const VALID_LOG_LEVELS: ReadonlySet<string> = new Set(['error', 'warn', 'info', 'debug']);

export class ElectronClient extends LDClientImpl {
  private readonly _plugins: LDPlugin[];

  private _closed: boolean = false;

  private _ipcNamespace?: string;

  // The listeners and handler channels this client registered, for exact removal.
  private _ipcRegisteredSync?: Array<{
    channel: string;
    listener: Parameters<typeof ipcMain.on>[1];
  }>;

  private _ipcRegisteredAsync?: string[];

  private _ipcEventSubscriptions?: Map<LDEmitterEventName, IpcEventSubscription>;

  // reverse lookup table to make removals faster
  private _ipcCallbackIdToEventName?: Map<string, LDEmitterEventName>;

  // queue to serialize add/remove so subscription map updates run in order
  private _ipcSubscriptionQueue?: Array<
    | { type: 'add'; event: IpcMainEvent; messageData: IpcEventCallback }
    | { type: 'remove'; event: IpcMainEvent; callbackId: string }
  >;

  constructor(credential: string, initialContext: LDContext, options: ElectronOptions = {}) {
    const { logger: customLogger, debug } = options;
    const logger =
      customLogger ??
      new BasicLogger({
        destination: {
          // eslint-disable-next-line no-console
          debug: console.debug,
          // eslint-disable-next-line no-console
          info: console.info,
          // eslint-disable-next-line no-console
          warn: console.warn,
          // eslint-disable-next-line no-console
          error: console.error,
        },
        level: debug ? 'debug' : 'info',
      });

    const validatedElectronOptions = validateOptions(options, logger);

    const { useClientSideId } = validatedElectronOptions;

    const internalOptions: LDClientInternalOptions = {
      analyticsEventPath: useClientSideId ? `/events/bulk/${credential}` : `/mobile`,
      diagnosticEventPath: useClientSideId
        ? `/events/diagnostic/${credential}`
        : `/mobile/events/diagnostic`,
      highTimeoutThreshold: 15,
      getImplementationHooks: (_environmentMetadata: LDPluginEnvironmentMetadata) =>
        internal.safeGetHooks(logger, _environmentMetadata, validatedElectronOptions.plugins),
      registerDebugOverrides: (debugOverride) =>
        safeRegisterDebugOverridePlugins(logger, debugOverride, validatedElectronOptions.plugins),
      credentialType: useClientSideId ? 'clientSideId' : 'mobileKey',
      requiresStart: true,
      initialContext,
    };

    const derivedNs = deriveNamespace(credential, validatedElectronOptions.namespace);

    // A duplicate namespace fails here, before the base client or any ipcMain handler exists.
    if (validatedElectronOptions.enableIPC) {
      assertNamespaceAvailable(derivedNs);
    }

    const platform = new ElectronPlatform(logger, validatedElectronOptions);
    const endpoints = useClientSideId ? browserFdv1Endpoints(credential) : mobileFdv1Endpoints();

    super(
      credential,
      AutoEnvAttributes.Disabled,
      platform,
      { ...filterToBaseOptions(options), logger },
      (
        flagManager: FlagManager,
        configuration: Configuration,
        baseHeaders: LDHeaders,
        emitter: LDEmitter,
        diagnosticsManager?: internal.DiagnosticsManager,
      ) =>
        new ElectronDataManager(
          platform,
          flagManager,
          credential,
          configuration,
          validatedElectronOptions,
          endpoints.polling,
          endpoints.streaming,
          baseHeaders,
          emitter,
          diagnosticsManager,
        ),
      internalOptions,
    );

    this._plugins = validatedElectronOptions.plugins;
    this.setEventSendingEnabled(!this.isOffline(), false);

    if (validatedElectronOptions.enableIPC) {
      try {
        this._openIPCChannels(derivedNs);
      } catch (e) {
        // The base client already runs its timers and data manager. Stop them before the throw
        // because the caller never receives an instance to close.
        this._closed = true;
        super.close().catch(() => {});
        throw e;
      }
    }
  }

  /**
   * Registers plugins with the given client. Called from makeClient with the facade
   * so plugins receive the public API (single identify that returns LDIdentifyResult).
   */
  registerPluginsWith(client: LDClient): void {
    internal.safeRegisterPlugins(this.logger, this.environmentMetadata, client, this._plugins);
  }

  override async identifyResult(
    context: LDContext,
    identifyOptions?: ElectronIdentifyOptions,
  ): Promise<LDIdentifyResult> {
    const options =
      identifyOptions?.sheddable === undefined
        ? { ...identifyOptions, sheddable: true }
        : identifyOptions;
    return super.identifyResult(context, options);
  }

  async setConnectionMode(mode: ConnectionMode): Promise<void> {
    // JS callers and renderers can pass any value. Log it bounded so a long string stays small.
    if (mode !== 'offline' && mode !== 'streaming' && mode !== 'polling') {
      this.logger.warn(
        `[ElectronClient] Unknown connection mode ${JSON.stringify(String(mode).slice(0, 64))}, ignoring.`,
      );
      return;
    }
    if (this._closed) {
      return;
    }
    if (mode === 'offline') {
      this.setEventSendingEnabled(false, true);
    }
    const dataManager = this.dataManager as ElectronDataManager;
    await dataManager.setConnectionMode(mode);
    // A concurrent call may have changed the mode during the await.
    if (mode !== 'offline' && dataManager.getConnectionMode() === mode) {
      this.setEventSendingEnabled(true, false);
    }
  }

  getConnectionMode(): ConnectionMode {
    const dataManager = this.dataManager as ElectronDataManager;
    return dataManager.getConnectionMode();
  }

  isOffline(): boolean {
    const dataManager = this.dataManager as ElectronDataManager;
    return dataManager.getConnectionMode() === 'offline';
  }

  setNetworkAvailability(available: boolean): void {
    const isAvailable = available === true;
    (this.dataManager as ElectronDataManager).setNetworkAvailability(isAvailable);
  }

  private _openIPCChannels(namespace: string): void {
    claimNamespace(namespace);
    this._ipcNamespace = namespace;
    this._ipcEventSubscriptions = new Map<LDEmitterEventName, IpcEventSubscription>();
    this._ipcCallbackIdToEventName = new Map<string, LDEmitterEventName>();
    this._ipcSubscriptionQueue = [];

    // Tracks the exact listeners and handler channels this client registered, so neither a
    // failure nor a close removes a listener that other code added to the same channel.
    const registeredSync: Array<{ channel: string; listener: Parameters<typeof ipcMain.on>[1] }> =
      [];
    const registeredAsync: string[] = [];
    this._ipcRegisteredSync = registeredSync;
    this._ipcRegisteredAsync = registeredAsync;
    const registerOn = (channel: string, listener: Parameters<typeof ipcMain.on>[1]) => {
      ipcMain.on(channel, listener);
      registeredSync.push({ channel, listener });
    };
    const registerHandle = (channel: string, listener: Parameters<typeof ipcMain.handle>[1]) => {
      ipcMain.handle(channel, listener);
      registeredAsync.push(channel);
    };

    try {
      // A handler channel throws when it is already taken. Register those first so a throw
      // happens before this client adds any listener.
      registerHandle(
        getIPCChannelName(namespace, 'waitForInitialization'),
        (
          _event,
          options?: LDWaitForInitializationOptions,
        ): Promise<LDWaitForInitializationResult> => this.waitForInitialization(options),
      );

      registerHandle(getIPCChannelName(namespace, 'flush'), (_event) => this.flush());

      registerHandle(getIPCChannelName(namespace, 'identify'), (_event, context, identifyOptions) =>
        this.identifyResult(context, identifyOptions),
      );

      registerHandle(getIPCChannelName(namespace, 'setConnectionMode'), (_event, mode) =>
        this.setConnectionMode(mode),
      );

      registerOn(
        getIPCChannelName(namespace, 'addEventHandler'),
        (event: IpcMainEvent, messageData: IpcEventCallback) => {
          this._ipcSubscriptionQueue!.push({ type: 'add', event, messageData });
          this._processSubscriptionQueue();
        },
      );

      registerOn(
        getIPCChannelName(namespace, 'removeEventHandler'),
        (event: IpcMainEvent, callbackId: string) => {
          this._ipcSubscriptionQueue!.push({ type: 'remove', event, callbackId });
          this._processSubscriptionQueue();
        },
      );

      registerOn(getIPCChannelName(namespace, 'allFlags'), (event) => {
        event.returnValue = this.allFlags();
      });

      registerOn(getIPCChannelName(namespace, 'boolVariation'), (event, key, defaultValue) => {
        event.returnValue = this.boolVariation(key, defaultValue);
      });

      registerOn(
        getIPCChannelName(namespace, 'boolVariationDetail'),
        (event, key, defaultValue) => {
          event.returnValue = this.boolVariationDetail(key, defaultValue);
        },
      );

      registerOn(getIPCChannelName(namespace, 'getContext'), (event) => {
        event.returnValue = this.getContext();
      });

      registerOn(getIPCChannelName(namespace, 'log'), (_event, level: string, message: string) => {
        if (VALID_LOG_LEVELS.has(level)) {
          this.logger[level as keyof LDLogger](message);
        }
      });

      registerOn(getIPCChannelName(namespace, 'jsonVariation'), (event, key, defaultValue) => {
        event.returnValue = this.jsonVariation(key, defaultValue);
      });

      registerOn(
        getIPCChannelName(namespace, 'jsonVariationDetail'),
        (event, key, defaultValue) => {
          event.returnValue = this.jsonVariationDetail(key, defaultValue);
        },
      );

      registerOn(getIPCChannelName(namespace, 'numberVariation'), (event, key, defaultValue) => {
        event.returnValue = this.numberVariation(key, defaultValue);
      });

      registerOn(
        getIPCChannelName(namespace, 'numberVariationDetail'),
        (event, key, defaultValue) => {
          event.returnValue = this.numberVariationDetail(key, defaultValue);
        },
      );

      registerOn(getIPCChannelName(namespace, 'stringVariation'), (event, key, defaultValue) => {
        event.returnValue = this.stringVariation(key, defaultValue);
      });

      registerOn(
        getIPCChannelName(namespace, 'stringVariationDetail'),
        (event, key, defaultValue) => {
          event.returnValue = this.stringVariationDetail(key, defaultValue);
        },
      );

      registerOn(getIPCChannelName(namespace, 'track'), (event, key, data, metricValue) => {
        event.returnValue = this.track(key, data, metricValue);
      });

      registerOn(getIPCChannelName(namespace, 'variation'), (event, key, defaultValue) => {
        event.returnValue = this.variation(key, defaultValue);
      });

      registerOn(getIPCChannelName(namespace, 'variationDetail'), (event, key, defaultValue) => {
        event.returnValue = this.variationDetail(key, defaultValue);
      });

      registerOn(getIPCChannelName(namespace, 'getConnectionMode'), (event) => {
        event.returnValue = this.getConnectionMode();
      });

      registerOn(getIPCChannelName(namespace, 'isOffline'), (event) => {
        event.returnValue = this.isOffline();
      });
    } catch (e) {
      // A failed registration must not leave the namespace claimed or this call's listeners attached.
      this._removeRegisteredIPCChannels();
      releaseNamespace(namespace);
      this._ipcNamespace = undefined;
      throw e;
    }
  }

  private _removeRegisteredIPCChannels(): void {
    this._ipcRegisteredSync?.forEach(({ channel, listener }) =>
      ipcMain.removeListener(channel, listener),
    );
    this._ipcRegisteredAsync?.forEach((channel) => ipcMain.removeHandler(channel));
    this._ipcRegisteredSync = undefined;
    this._ipcRegisteredAsync = undefined;
  }

  /**
   * Runs subscription queue in order so add/remove operations updating the subscription maps
   * are serialized and never interleaved.
   */
  private _processSubscriptionQueue(): void {
    const queue = this._ipcSubscriptionQueue!;
    while (queue.length > 0) {
      const op = queue.shift()!;
      if (op.type === 'add') {
        this._applyAdd(op.event, op.messageData);
      } else {
        this._applyRemove(op.event, op.callbackId);
      }
    }
  }

  private _applyAdd(event: IpcMainEvent, messageData: IpcEventCallback): void {
    const { callbackId, eventName } = messageData;
    const [port] = event.ports;
    if (!port) {
      return;
    }
    let entry = this._ipcEventSubscriptions!.get(eventName);
    if (!entry) {
      const ports = new Map<string, MessagePortMain>();
      const broadcastCallback = (...args: unknown[]) => {
        ports.forEach((p) => {
          try {
            p.postMessage(args);
          } catch {
            this.logger.warn(`Event ${eventName} broadcast failed`);
          }
        });
      };
      this.on(eventName, broadcastCallback);
      entry = { broadcastCallback, ports };
      this._ipcEventSubscriptions!.set(eventName, entry);
    }
    entry.ports.set(callbackId, port);
    this._ipcCallbackIdToEventName!.set(callbackId, eventName);
  }

  private _applyRemove(event: IpcMainEvent, callbackId: string): void {
    const eventName = this._ipcCallbackIdToEventName!.get(callbackId);
    if (!eventName) {
      event.returnValue = false;
      return;
    }
    const entry = this._ipcEventSubscriptions!.get(eventName);
    const port = entry?.ports.get(callbackId);
    if (!entry || !port) {
      event.returnValue = false;
      return;
    }
    entry.ports.delete(callbackId);
    this._ipcCallbackIdToEventName!.delete(callbackId);
    port.close();
    if (entry.ports.size === 0) {
      this.off(eventName, entry.broadcastCallback);
      this._ipcEventSubscriptions!.delete(eventName);
    }
    event.returnValue = true;
  }

  private _closeIPCChannels(): void {
    if (!this._ipcNamespace) {
      return;
    }

    if (this._ipcEventSubscriptions) {
      this._ipcEventSubscriptions.forEach((entry, eventName) => {
        this.off(eventName, entry.broadcastCallback);
        entry.ports.forEach((port) => port.close());
      });
      this._ipcEventSubscriptions.clear();
    }
    this._ipcCallbackIdToEventName?.clear();
    this._ipcSubscriptionQueue = undefined;

    this._removeRegisteredIPCChannels();
    releaseNamespace(this._ipcNamespace);

    this._ipcEventSubscriptions = undefined;
    this._ipcCallbackIdToEventName = undefined;
    this._ipcSubscriptionQueue = undefined;
    this._ipcNamespace = undefined;
  }

  override async close(): Promise<void> {
    this._closed = true;
    this._closeIPCChannels();
    await super.close();
  }
}

/**
 * Builds the LaunchDarkly client facade (PIMPL). Exposes a single identify method that returns
 * identify results. Plugins are registered with the facade.
 */
export function makeClient(
  credential: string,
  initialContext: LDContext,
  options: ElectronOptions = {},
): LDClient {
  const impl = new ElectronClient(credential, initialContext, options);

  const client: LDClient = {
    variation: (key: string, defaultValue?: LDFlagValue) => impl.variation(key, defaultValue),
    variationDetail: (key: string, defaultValue?: LDFlagValue) =>
      impl.variationDetail(key, defaultValue),
    boolVariation: (key: string, defaultValue: boolean) => impl.boolVariation(key, defaultValue),
    boolVariationDetail: (key: string, defaultValue: boolean) =>
      impl.boolVariationDetail(key, defaultValue),
    numberVariation: (key: string, defaultValue: number) => impl.numberVariation(key, defaultValue),
    numberVariationDetail: (key: string, defaultValue: number) =>
      impl.numberVariationDetail(key, defaultValue),
    stringVariation: (key: string, defaultValue: string) => impl.stringVariation(key, defaultValue),
    stringVariationDetail: (key: string, defaultValue: string) =>
      impl.stringVariationDetail(key, defaultValue),
    jsonVariation: (key: string, defaultValue: unknown) => impl.jsonVariation(key, defaultValue),
    jsonVariationDetail: (key: string, defaultValue: unknown) =>
      impl.jsonVariationDetail(key, defaultValue),
    track: (key: string, data?: unknown, metricValue?: number) =>
      impl.track(key, data, metricValue),
    on: (key: string, callback: (...args: unknown[]) => void) =>
      impl.on(key as LDEmitterEventName, callback as (...args: unknown[]) => void),
    off: (key: string, callback: (...args: unknown[]) => void) =>
      impl.off(key as LDEmitterEventName, callback as (...args: unknown[]) => void),
    flush: () => impl.flush(),
    identify: (ctx: LDContext, identifyOptions?: ElectronIdentifyOptions) =>
      impl.identifyResult(ctx, identifyOptions),
    getContext: () => impl.getContext(),
    close: () => impl.close(),
    allFlags: () => impl.allFlags(),
    addHook: (hook: Parameters<LDClient['addHook']>[0]) => impl.addHook(hook),
    waitForInitialization: (waitOptions?: Parameters<LDClient['waitForInitialization']>[0]) =>
      impl.waitForInitialization(waitOptions),
    logger: impl.logger,
    start: (startOptions?: LDStartOptions) => impl.start(startOptions),
    setConnectionMode: (mode: Parameters<LDClient['setConnectionMode']>[0]) =>
      impl.setConnectionMode(mode),
    getConnectionMode: () => impl.getConnectionMode(),
    isOffline: () => impl.isOffline(),
    setNetworkAvailability: (available: boolean) => impl.setNetworkAvailability(available),
  };

  impl.registerPluginsWith(client);

  return client;
}
