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
  LDIdentifyOptions,
  LDIdentifyResult,
  LDLogger,
  LDPluginEnvironmentMetadata,
  LDWaitForInitializationOptions,
  LDWaitForInitializationResult,
  mobileFdv1Endpoints,
} from '@launchdarkly/js-client-sdk-common';

import ElectronDataManager from './ElectronDataManager';
import {
  AllAsyncChannels,
  AllSyncChannels,
  deriveNamespace,
  getIPCChannelName,
  IpcEventCallback,
  IpcEventSubscription,
} from './ElectronIPC';
import type { ElectronOptions } from './ElectronOptions';
import type { LDClient, LDStartOptions } from './LDClient';
import type { LDPlugin } from './LDPlugin';
import validateOptions, { filterToBaseOptions } from './options';
import ElectronPlatform from './platform/ElectronPlatform';

const VALID_LOG_LEVELS: ReadonlySet<string> = new Set(['error', 'warn', 'info', 'debug']);

export class ElectronClient extends LDClientImpl {
  private readonly _plugins: LDPlugin[];

  private _ipcNamespace?: string;

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
      credentialType: useClientSideId ? 'clientSideId' : 'mobileKey',
      requiresStart: true,
      initialContext,
    };

    const platform = new ElectronPlatform(logger, options);
    const derivedNs = deriveNamespace(credential, validatedElectronOptions.namespace);
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
      this._openIPCChannels(derivedNs);
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
    identifyOptions?: LDIdentifyOptions,
  ): Promise<LDIdentifyResult> {
    const options =
      identifyOptions?.sheddable === undefined
        ? { ...identifyOptions, sheddable: true }
        : identifyOptions;
    return super.identifyResult(context, options);
  }

  async setConnectionMode(mode: ConnectionMode): Promise<void> {
    if (mode === 'offline') {
      this.setEventSendingEnabled(false, true);
    }
    const dataManager = this.dataManager as ElectronDataManager;
    await dataManager.setConnectionMode(mode);
    if (mode !== 'offline') {
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

  private _openIPCChannels(namespace: string): void {
    this._ipcNamespace = namespace;
    this._ipcEventSubscriptions = new Map<LDEmitterEventName, IpcEventSubscription>();
    this._ipcCallbackIdToEventName = new Map<string, LDEmitterEventName>();
    this._ipcSubscriptionQueue = [];

    ipcMain.on(
      getIPCChannelName(namespace, 'addEventHandler'),
      (event: IpcMainEvent, messageData: IpcEventCallback) => {
        this._ipcSubscriptionQueue!.push({ type: 'add', event, messageData });
        this._processSubscriptionQueue();
      },
    );

    ipcMain.on(
      getIPCChannelName(namespace, 'removeEventHandler'),
      (event: IpcMainEvent, callbackId: string) => {
        this._ipcSubscriptionQueue!.push({ type: 'remove', event, callbackId });
        this._processSubscriptionQueue();
      },
    );

    ipcMain.handle(
      getIPCChannelName(namespace, 'waitForInitialization'),
      (_event, options?: LDWaitForInitializationOptions): Promise<LDWaitForInitializationResult> =>
        this.waitForInitialization(options),
    );

    ipcMain.on(getIPCChannelName(namespace, 'allFlags'), (event) => {
      event.returnValue = this.allFlags();
    });

    ipcMain.on(getIPCChannelName(namespace, 'boolVariation'), (event, key, defaultValue) => {
      event.returnValue = this.boolVariation(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'boolVariationDetail'), (event, key, defaultValue) => {
      event.returnValue = this.boolVariationDetail(key, defaultValue);
    });

    ipcMain.handle(getIPCChannelName(namespace, 'flush'), (_event) => this.flush());

    ipcMain.on(getIPCChannelName(namespace, 'getContext'), (event) => {
      event.returnValue = this.getContext();
    });

    ipcMain.handle(getIPCChannelName(namespace, 'identify'), (_event, context, identifyOptions) =>
      this.identifyResult(context, identifyOptions),
    );

    ipcMain.on(getIPCChannelName(namespace, 'log'), (_event, level: string, message: string) => {
      if (VALID_LOG_LEVELS.has(level)) {
        this.logger[level as keyof LDLogger](message);
      }
    });

    ipcMain.on(getIPCChannelName(namespace, 'jsonVariation'), (event, key, defaultValue) => {
      event.returnValue = this.jsonVariation(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'jsonVariationDetail'), (event, key, defaultValue) => {
      event.returnValue = this.jsonVariationDetail(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'numberVariation'), (event, key, defaultValue) => {
      event.returnValue = this.numberVariation(key, defaultValue);
    });

    ipcMain.on(
      getIPCChannelName(namespace, 'numberVariationDetail'),
      (event, key, defaultValue) => {
        event.returnValue = this.numberVariationDetail(key, defaultValue);
      },
    );

    ipcMain.on(getIPCChannelName(namespace, 'stringVariation'), (event, key, defaultValue) => {
      event.returnValue = this.stringVariation(key, defaultValue);
    });

    ipcMain.on(
      getIPCChannelName(namespace, 'stringVariationDetail'),
      (event, key, defaultValue) => {
        event.returnValue = this.stringVariationDetail(key, defaultValue);
      },
    );

    ipcMain.on(getIPCChannelName(namespace, 'track'), (event, key, data, metricValue) => {
      event.returnValue = this.track(key, data, metricValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'variation'), (event, key, defaultValue) => {
      event.returnValue = this.variation(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(namespace, 'variationDetail'), (event, key, defaultValue) => {
      event.returnValue = this.variationDetail(key, defaultValue);
    });

    ipcMain.handle(getIPCChannelName(namespace, 'setConnectionMode'), (_event, mode) =>
      this.setConnectionMode(mode),
    );

    ipcMain.on(getIPCChannelName(namespace, 'getConnectionMode'), (event) => {
      event.returnValue = this.getConnectionMode();
    });

    ipcMain.on(getIPCChannelName(namespace, 'isOffline'), (event) => {
      event.returnValue = this.isOffline();
    });
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

    AllSyncChannels.forEach((channel) => {
      ipcMain.removeAllListeners(getIPCChannelName(this._ipcNamespace!, channel));
    });
    AllAsyncChannels.forEach((channel) => {
      ipcMain.removeHandler(getIPCChannelName(this._ipcNamespace!, channel));
    });

    this._ipcEventSubscriptions = undefined;
    this._ipcCallbackIdToEventName = undefined;
    this._ipcSubscriptionQueue = undefined;
    this._ipcNamespace = undefined;
  }

  override async close(): Promise<void> {
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
    identify: (ctx: LDContext, identifyOptions?: LDIdentifyOptions) =>
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
  };

  impl.registerPluginsWith(client);

  return client;
}
