import { ipcMain } from 'electron';

import {
  AutoEnvAttributes,
  base64UrlEncode,
  BasicLogger,
  Configuration,
  ConnectionMode,
  Encoding,
  FlagManager,
  internal,
  LDClientImpl,
  LDClientInternalOptions,
  LDContext,
  LDEmitter,
  LDHeaders,
  LDIdentifyResult,
  LDPluginEnvironmentMetadata,
  LDWaitForInitializationOptions,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk-common';

import { readFlagsFromBootstrap } from './bootstrap';
import ElectronDataManager from './ElectronDataManager';
import type { ElectronIdentifyOptions } from './ElectronIdentifyOptions';
import {
  AllAsyncChannels,
  AllSyncChannels,
  getIPCChannelName,
  IpcEventHandler,
} from './ElectronIPC';
import type { ElectronOptions as LDOptions } from './ElectronOptions';
import type { LDClient, LDStartOptions } from './LDClient';
import type { LDPlugin } from './LDPlugin';
import validateOptions, { filterToBaseOptions } from './options';
import ElectronPlatform from './platform/ElectronPlatform';

// NOTE: we can choose to validate events with a whitelist? However, this might be
// more for the implementers to do.

// TODO: we will need to refactor the verbiage of client side id to mobile key in the future.
export class ElectronClient extends LDClientImpl {
  private readonly _initialContext: LDContext;

  private _startPromise?: Promise<LDWaitForInitializationResult>;

  private readonly _plugins: LDPlugin[];

  private _ipcNamespace?: string;

  private _ipcEventHandlers?: Map<string, IpcEventHandler>;

  constructor(credential: string, initialContext: LDContext, options: LDOptions = {}) {
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
    };

    const platform = new ElectronPlatform(logger, credential, options);

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
          () => ({
            pathGet(encoding: Encoding, _plainContextString: string): string {
              return useClientSideId
                ? `/sdk/evalx/${credential}/contexts/${base64UrlEncode(_plainContextString, encoding)}`
                : `/msdk/evalx/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
            },
            pathReport(_encoding: Encoding, _plainContextString: string): string {
              return useClientSideId ? `/sdk/evalx/${credential}/context` : `/msdk/evalx/context`;
            },
            pathPing(_encoding: Encoding, _plainContextString: string): string {
              // Note: if you are seeing this error, it is a coding error. This DataSourcePaths implementation is for polling endpoints. /ping is not currently
              // used in a polling situation. It is probably the case that this was called by streaming logic erroneously.
              throw new Error('Ping for polling unsupported.');
            },
          }),
          () => ({
            pathGet(encoding: Encoding, _plainContextString: string): string {
              return useClientSideId
                ? `/eval/${credential}/${base64UrlEncode(_plainContextString, encoding)}`
                : `/meval/${base64UrlEncode(_plainContextString, encoding)}`;
            },
            pathReport(_encoding: Encoding, _plainContextString: string): string {
              return useClientSideId ? `/eval/${credential}` : `/meval`;
            },
            pathPing(_encoding: Encoding, _plainContextString: string): string {
              return useClientSideId ? `/ping/${credential}` : `/mping`;
            },
          }),
          baseHeaders,
          emitter,
          diagnosticsManager,
        ),
      internalOptions,
    );

    this._initialContext = initialContext;
    this._plugins = validatedElectronOptions.plugins;
    this.setEventSendingEnabled(!this.isOffline(), false);

    if (validatedElectronOptions.enableIPC) {
      this._openIPCChannels(credential);
    }
  }

  /**
   * Registers plugins with the given client. Called from makeClient with the facade
   * so plugins receive the public API (single identify that returns LDIdentifyResult).
   */
  registerPluginsWith(client: LDClient): void {
    internal.safeRegisterPlugins(this.logger, this.environmentMetadata, client, this._plugins);
  }

  start(options?: LDStartOptions): Promise<LDWaitForInitializationResult> {
    if (this.initializeResult !== undefined) {
      return Promise.resolve(this.initializeResult);
    }
    if (this._startPromise) {
      return this._startPromise;
    }
    if (!this._initialContext) {
      this.logger.error('Initial context not set');
      return Promise.resolve({ status: 'failed', error: new Error('Initial context not set') });
    }

    const identifyOptions: ElectronIdentifyOptions = {
      ...(options?.identifyOptions ?? {}),
      sheddable: false,
    };

    if (
      options?.bootstrap !== undefined &&
      options?.bootstrap !== null &&
      !identifyOptions.bootstrap
    ) {
      identifyOptions.bootstrap = options.bootstrap;
    }

    if (identifyOptions.bootstrap) {
      try {
        if (!identifyOptions.bootstrapParsed) {
          identifyOptions.bootstrapParsed = readFlagsFromBootstrap(
            this.logger,
            identifyOptions.bootstrap,
          );
        }
        this.presetFlags(identifyOptions.bootstrapParsed!);
      } catch (error) {
        this.logger.error('Failed to bootstrap data', error);
      }
    }

    if (!this.initializedPromise) {
      this.initializedPromise = new Promise((resolve) => {
        this.initResolve = resolve;
      });
    }

    this._startPromise = this.promiseWithTimeout(this.initializedPromise!, options?.timeout ?? 5);

    this.identify(this._initialContext, identifyOptions);
    return this._startPromise;
  }

  override async identifyResult(
    pristineContext: LDContext,
    identifyOptions?: ElectronIdentifyOptions,
  ): Promise<LDIdentifyResult> {
    if (!this._startPromise) {
      this.logger.error(
        'Client must be started before it can identify a context, did you forget to call start()?',
      );
      return { status: 'error', error: new Error('Identify called before start') };
    }

    const identifyOptionsWithUpdatedDefaults = {
      ...identifyOptions,
    };
    if (identifyOptions?.sheddable === undefined) {
      identifyOptionsWithUpdatedDefaults.sheddable = true;
    }

    const options = identifyOptionsWithUpdatedDefaults;
    if (options.bootstrap) {
      try {
        if (!options.bootstrapParsed) {
          (options as ElectronIdentifyOptions).bootstrapParsed = readFlagsFromBootstrap(
            this.logger,
            options.bootstrap,
          );
        }
        this.presetFlags(options.bootstrapParsed!);
      } catch (error) {
        this.logger.error('Failed to bootstrap data', error);
      }
    }

    return super.identifyResult(pristineContext, identifyOptionsWithUpdatedDefaults);
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

  private _openIPCChannels(credential: string): void {
    this._ipcNamespace = credential;
    this._ipcEventHandlers = new Map<string, IpcEventHandler>();

    ipcMain.on(getIPCChannelName(credential, 'addEventHandler'), (event, messageData) => {
      const { callbackId, eventName } = messageData;
      if (!this._ipcEventHandlers!.has(callbackId)) {
        const [port] = event.ports;
        const callback = (...args: any[]) => {
          port.postMessage(args);
        };
        this.on(eventName, callback);
        this._ipcEventHandlers!.set(callbackId, { port, eventName, callback });
      }
    });

    ipcMain.on(
      getIPCChannelName(credential, 'removeEventHandler'),
      (event, eventName, callbackId) => {
        const existingHandler = this._ipcEventHandlers!.get(callbackId);
        if (existingHandler && existingHandler.eventName === eventName) {
          this.off(eventName, existingHandler.callback);
          existingHandler.port.close();
          this._ipcEventHandlers!.delete(callbackId);
          // eslint-disable-next-line no-param-reassign
          event.returnValue = true;
        } else {
          // eslint-disable-next-line no-param-reassign
          event.returnValue = false;
        }
      },
    );

    ipcMain.handle(
      getIPCChannelName(credential, 'waitForInitialization'),
      (_event, options?: LDWaitForInitializationOptions): Promise<LDWaitForInitializationResult> =>
        this.waitForInitialization(options),
    );

    ipcMain.on(getIPCChannelName(credential, 'allFlags'), (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.allFlags();
    });

    ipcMain.on(getIPCChannelName(credential, 'boolVariation'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.boolVariation(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(credential, 'boolVariationDetail'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.boolVariationDetail(key, defaultValue);
    });

    ipcMain.handle(getIPCChannelName(credential, 'flush'), (_event) => this.flush());

    ipcMain.on(getIPCChannelName(credential, 'getContext'), (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.getContext();
    });

    ipcMain.handle(getIPCChannelName(credential, 'identify'), (_event, context, identifyOptions) =>
      this.identifyResult(context, identifyOptions),
    );

    ipcMain.on(getIPCChannelName(credential, 'jsonVariation'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.jsonVariation(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(credential, 'jsonVariationDetail'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.jsonVariationDetail(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(credential, 'numberVariation'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.numberVariation(key, defaultValue);
    });

    ipcMain.on(
      getIPCChannelName(credential, 'numberVariationDetail'),
      (event, key, defaultValue) => {
        // eslint-disable-next-line no-param-reassign
        event.returnValue = this.numberVariationDetail(key, defaultValue);
      },
    );

    ipcMain.on(getIPCChannelName(credential, 'stringVariation'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.stringVariation(key, defaultValue);
    });

    ipcMain.on(
      getIPCChannelName(credential, 'stringVariationDetail'),
      (event, key, defaultValue) => {
        // eslint-disable-next-line no-param-reassign
        event.returnValue = this.stringVariationDetail(key, defaultValue);
      },
    );

    ipcMain.on(getIPCChannelName(credential, 'track'), (event, key, data, metricValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.track(key, data, metricValue);
    });

    ipcMain.on(getIPCChannelName(credential, 'variation'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.variation(key, defaultValue);
    });

    ipcMain.on(getIPCChannelName(credential, 'variationDetail'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.variationDetail(key, defaultValue);
    });

    ipcMain.handle(getIPCChannelName(credential, 'setConnectionMode'), (_event, mode) =>
      this.setConnectionMode(mode),
    );

    ipcMain.on(getIPCChannelName(credential, 'getConnectionMode'), (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.getConnectionMode();
    });

    ipcMain.on(getIPCChannelName(credential, 'isOffline'), (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.isOffline();
    });
  }

  private _closeIPCChannels(): void {
    if (!this._ipcNamespace) {
      return;
    }

    if (this._ipcEventHandlers) {
      this._ipcEventHandlers.forEach((handler: IpcEventHandler) => {
        handler.port.close();
        this.off(handler.eventName, handler.callback);
      });
      this._ipcEventHandlers.clear();
    }

    AllSyncChannels.forEach((channel) => {
      ipcMain.removeAllListeners(getIPCChannelName(this._ipcNamespace!, channel));
    });
    AllAsyncChannels.forEach((channel) => {
      ipcMain.removeHandler(getIPCChannelName(this._ipcNamespace!, channel));
    });

    this._ipcEventHandlers = undefined;
    this._ipcNamespace = undefined;
  }

  override async close(): Promise<void> {
    this._closeIPCChannels();
    await super.close();
  }
}
