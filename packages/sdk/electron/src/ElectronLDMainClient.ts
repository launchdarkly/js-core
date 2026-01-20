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
  LDEmitter,
  LDHeaders,
  LDPluginEnvironmentMetadata,
} from '@launchdarkly/js-client-sdk-common';

import ElectronDataManager from './ElectronDataManager';
import type { ElectronOptions as LDOptions } from './ElectronOptions';
import type { LDClient } from './LDClient';
import validateOptions, { filterToBaseOptions } from './options';
import ElectronPlatform from './platform/ElectronPlatform';

export class ElectronLDMainClient extends LDClientImpl implements LDClient {
  constructor(clientSideId: string, options: LDOptions = {}) {
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

    const internalOptions: LDClientInternalOptions = {
      analyticsEventPath: `/events/bulk/${clientSideId}`,
      diagnosticEventPath: `/events/diagnostic/${clientSideId}`,
      highTimeoutThreshold: 15,
      getImplementationHooks: (_environmentMetadata: LDPluginEnvironmentMetadata) =>
        internal.safeGetHooks(logger, _environmentMetadata, validatedElectronOptions.plugins),
      credentialType: 'clientSideId',
    };

    const platform = new ElectronPlatform(logger, clientSideId, options);

    super(
      clientSideId,
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
          clientSideId,
          configuration,
          validatedElectronOptions,
          () => ({
            pathGet(encoding: Encoding, _plainContextString: string): string {
              return `/sdk/evalx/${clientSideId}/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
            },
            pathReport(_encoding: Encoding, _plainContextString: string): string {
              return `/sdk/evalx/${clientSideId}/context`;
            },
            pathPing(_encoding: Encoding, _plainContextString: string): string {
              // Note: if you are seeing this error, it is a coding error. This DataSourcePaths implementation is for polling endpoints. /ping is not currently
              // used in a polling situation. It is probably the case that this was called by streaming logic erroneously.
              throw new Error('Ping for polling unsupported.');
            },
          }),
          () => ({
            pathGet(encoding: Encoding, _plainContextString: string): string {
              return `/eval/${clientSideId}/${base64UrlEncode(_plainContextString, encoding)}`;
            },
            pathReport(_encoding: Encoding, _plainContextString: string): string {
              return `/eval/${clientSideId}`;
            },
            pathPing(_encoding: Encoding, _plainContextString: string): string {
              return `/ping/${clientSideId}`;
            },
          }),
          baseHeaders,
          emitter,
          diagnosticsManager,
        ),
      internalOptions,
    );

    this.setEventSendingEnabled(!this.isOffline(), false);

    internal.safeRegisterPlugins(
      logger,
      this.environmentMetadata,
      this,
      validatedElectronOptions.plugins,
    );

    if (validatedElectronOptions.registerInMain) {
      this._registerInMain(clientSideId);
    }
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

  private _registerInMain(clientSideId: string): void {
    interface Handler {
      port: Electron.MessagePortMain;
      eventName: string;
      callback: (...args: any[]) => void;
    }

    const eventHandlers: Map<string, Handler> = new Map();

    const getEventName = (baseName: string) => `ld:${clientSideId}:${baseName}`;

    ipcMain.on(getEventName('addEventHandler'), (event, messageData) => {
      const { callbackId, eventName } = messageData;
      if (!eventHandlers.has(callbackId)) {
        const [port] = event.ports;
        const callback = (...args: any[]) => {
          console.log(`MAIN HANDLER FOR CALLBACK ${callbackId} CALLED`);
          port.postMessage(args);
        };
        this.on(eventName, callback);
        console.log(`MAIN HANDLER FOR CALLBACK ${callbackId} ADDED`);
        eventHandlers.set(callbackId, { port, eventName, callback });
      }
    });

    ipcMain.on(getEventName('removeEventHandler'), (event, eventName, callbackId) => {
      const existingHandler = eventHandlers.get(callbackId);
      if (existingHandler && existingHandler.eventName === eventName) {
        console.log(`MAIN HANDLER FOR CALLBACK ${callbackId} REMOVED`);
        this.off(eventName, existingHandler.callback);
        existingHandler.port.close();
        eventHandlers.delete(callbackId);
        // eslint-disable-next-line no-param-reassign
        event.returnValue = true;
      } else {
        // eslint-disable-next-line no-param-reassign
        event.returnValue = false;
      }
    });

    ipcMain.on(getEventName('allFlags'), (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.allFlags();
    });

    ipcMain.on(getEventName('boolVariation'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.boolVariation(key, defaultValue);
    });

    ipcMain.on(getEventName('boolVariationDetail'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.boolVariationDetail(key, defaultValue);
    });

    ipcMain.handle(getEventName('flush'), (_event) => this.flush());

    ipcMain.on(getEventName('getContext'), (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.getContext();
    });

    ipcMain.handle(getEventName('identify'), (_event, context, identifyOptions) =>
      this.identify(context, identifyOptions),
    );

    ipcMain.on(getEventName('jsonVariation'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.jsonVariation(key, defaultValue);
    });

    ipcMain.on(getEventName('jsonVariationDetail'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.jsonVariationDetail(key, defaultValue);
    });

    ipcMain.on(getEventName('numberVariation'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.numberVariation(key, defaultValue);
    });

    ipcMain.on(getEventName('numberVariationDetail'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.numberVariationDetail(key, defaultValue);
    });

    ipcMain.on(getEventName('stringVariation'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.stringVariation(key, defaultValue);
    });

    ipcMain.on(getEventName('stringVariationDetail'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.stringVariationDetail(key, defaultValue);
    });

    ipcMain.on(getEventName('track'), (event, key, data, metricValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.track(key, data, metricValue);
    });

    ipcMain.on(getEventName('variation'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.variation(key, defaultValue);
    });

    ipcMain.on(getEventName('variationDetail'), (event, key, defaultValue) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.variationDetail(key, defaultValue);
    });

    ipcMain.handle(getEventName('setConnectionMode'), (_event, mode) =>
      this.setConnectionMode(mode),
    );

    ipcMain.on(getEventName('getConnectionMode'), (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.getConnectionMode();
    });

    ipcMain.on(getEventName('isOffline'), (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.isOffline();
    });
  }
}
