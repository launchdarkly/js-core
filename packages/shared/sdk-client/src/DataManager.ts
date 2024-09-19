import {
  Context,
  EventName,
  internal,
  LDContext,
  LDHeaders,
  LDLogger,
  Platform,
  ProcessStreamResponse,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import ConnectionMode from './api/ConnectionMode';
import { LDIdentifyOptions } from './api/LDIdentifyOptions';
import Configuration from './configuration';
import FlagManager from './flag-manager/FlagManager';
import { ItemDescriptor } from './flag-manager/ItemDescriptor';
import LDEmitter from './LDEmitter';
import PollingProcessor from './polling/PollingProcessor';
import { DataSourcePaths, StreamingProcessor } from './streaming';
import { DeleteFlag, Flags, PatchFlag } from './types';

export interface DataManager {
  identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void>;

  setConnectionMode(mode: ConnectionMode): Promise<void>;
}

export interface DataManagerFactory {
  (
    platform: Platform,
    flagManager: FlagManager,
    credential: string,
    configuration: Configuration,
    getPollingPaths: () => DataSourcePaths,
    getStreamingPaths: () => DataSourcePaths,
    baseHeaders: LDHeaders,
    emitter: LDEmitter,
  ): DataManager;
}

export class DefaultDataManager implements DataManager {
  private updateProcessor?: subsystem.LDStreamProcessor;
  private readonly logger: LDLogger;
  private connectionMode: ConnectionMode = 'streaming';
  private context?: Context;
  private identifyTimeout?: number;

  constructor(
    private readonly platform: Platform,
    private readonly flagManager: FlagManager,
    private readonly credential: string,
    private readonly config: Configuration,
    private readonly getPollingPaths: () => DataSourcePaths,
    private readonly getStreamingPaths: () => DataSourcePaths,
    private readonly baseHeaders: LDHeaders,
    private readonly emitter: LDEmitter,
    private readonly diagnosticsManager: internal.DiagnosticsManager,
  ) {
    this.logger = config.logger;
    this.connectionMode = config.initialConnectionMode;
  }

  setConnectionMode(mode: ConnectionMode): Promise<void> {
    if (this.connectionMode === mode) {
      this.logger.debug(`setConnectionMode ignored. Mode is already '${mode}'.`);
      return Promise.resolve();
    }

    this.connectionMode = mode;
    this.logger.debug(`setConnectionMode ${mode}.`);

    switch (mode) {
      case 'offline':
        this.updateProcessor?.close();
        break;
      case 'polling':
      case 'streaming':
        if (this.context) {
          // identify will start the update processor
          this.setupConnection(this.context);
        }

        break;
      default:
        this.logger.warn(
          `Unknown ConnectionMode: ${mode}. Only 'offline', 'streaming', and 'polling' are supported.`,
        );
        break;
    }

    return Promise.resolve();
  }

  async identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    identifyOptions?: LDIdentifyOptions,
  ) {
    this.identifyTimeout = identifyOptions?.timeout;
    const loadedFromCache = await this.flagManager.loadCached(context);
    if (loadedFromCache && !identifyOptions?.waitForNetworkResults) {
      this.logger.debug('Identify completing with cached flags');
      identifyResolve();
    }
    if (loadedFromCache && identifyOptions?.waitForNetworkResults) {
      this.logger.debug(
        'Identify - Flags loaded from cache, but identify was requested with "waitForNetworkResults"',
      );
    }

    if (this.connectionMode === 'offline') {
      if (loadedFromCache) {
        this.logger.debug('Offline identify - using cached flags.');
      } else {
        this.logger.debug(
          'Offline identify - no cached flags, using defaults or already loaded flags.',
        );
        identifyResolve();
      }
    } else {
      // Context has been validated in LDClientImpl.identify
      this.setupConnection(context, identifyResolve, identifyReject);
    }
  }

  private setupConnection(
    context: Context,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
  ) {
    const rawContext = Context.toLDContext(context)!;
    this.updateProcessor?.close();
    switch (this.connectionMode) {
      case 'streaming':
        this.createStreamingProcessor(rawContext, context, identifyResolve, identifyReject);
        break;
      case 'polling':
        this.createPollingProcessor(rawContext, context, identifyResolve, identifyReject);
        break;
      default:
        break;
    }
    this.updateProcessor!.start();
  }

  private createPollingProcessor(
    context: LDContext,
    checkedContext: Context,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
  ) {
    this.updateProcessor = new PollingProcessor(
      JSON.stringify(context),
      {
        credential: this.credential,
        serviceEndpoints: this.config.serviceEndpoints,
        paths: this.getPollingPaths(),
        baseHeaders: this.baseHeaders,
        pollInterval: this.config.pollInterval,
        withReasons: this.config.withReasons,
        useReport: this.config.useReport,
      },
      this.platform.requests,
      this.platform.encoding!,
      async (flags) => {
        this.logger.debug(`Handling polling result: ${Object.keys(flags)}`);

        // mapping flags to item descriptors
        const descriptors = Object.entries(flags).reduce(
          (acc: { [k: string]: ItemDescriptor }, [key, flag]) => {
            acc[key] = { version: flag.version, flag };
            return acc;
          },
          {},
        );

        await this.flagManager.init(checkedContext, descriptors);
        identifyResolve?.();
      },
      (err) => {
        identifyReject?.(err);
        this.emitter.emit('error', context, err);
      },
    );
  }

  private createStreamingProcessor(
    context: LDContext,
    checkedContext: Context,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
  ) {
    this.updateProcessor = new StreamingProcessor(
      JSON.stringify(context),
      {
        credential: this.credential,
        serviceEndpoints: this.config.serviceEndpoints,
        paths: this.getStreamingPaths(),
        baseHeaders: this.baseHeaders,
        initialRetryDelayMillis: this.config.streamInitialReconnectDelay * 1000,
        withReasons: this.config.withReasons,
        useReport: this.config.useReport,
      },
      this.createStreamListeners(checkedContext, identifyResolve),
      this.platform.requests,
      this.platform.encoding!,
      this.diagnosticsManager,
      (e) => {
        identifyReject?.(e);
        this.emitter.emit('error', context, e);
      },
    );
  }

  private createStreamListeners(
    context: Context,
    identifyResolve?: () => void,
  ): Map<EventName, ProcessStreamResponse> {
    const listeners = new Map<EventName, ProcessStreamResponse>();

    listeners.set('put', {
      deserializeData: JSON.parse,
      processJson: async (evalResults: Flags) => {
        this.logger.debug(`Stream PUT: ${Object.keys(evalResults)}`);

        // mapping flags to item descriptors
        const descriptors = Object.entries(evalResults).reduce(
          (acc: { [k: string]: ItemDescriptor }, [key, flag]) => {
            acc[key] = { version: flag.version, flag };
            return acc;
          },
          {},
        );
        await this.flagManager.init(context, descriptors);
        identifyResolve?.();
      },
    });

    listeners.set('patch', {
      deserializeData: JSON.parse,
      processJson: async (patchFlag: PatchFlag) => {
        this.logger.debug(`Stream PATCH ${JSON.stringify(patchFlag, null, 2)}`);
        this.flagManager.upsert(context, patchFlag.key, {
          version: patchFlag.version,
          flag: patchFlag,
        });
      },
    });

    listeners.set('delete', {
      deserializeData: JSON.parse,
      processJson: async (deleteFlag: DeleteFlag) => {
        this.logger.debug(`Stream DELETE ${JSON.stringify(deleteFlag, null, 2)}`);

        this.flagManager.upsert(context, deleteFlag.key, {
          version: deleteFlag.version,
          flag: {
            ...deleteFlag,
            deleted: true,
            // props below are set to sensible defaults. they are irrelevant
            // because this flag has been deleted.
            flagVersion: 0,
            value: undefined,
            variation: 0,
            trackEvents: false,
          },
        });
      },
    });

    return listeners;
  }
}
