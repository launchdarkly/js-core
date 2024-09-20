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
import { Configuration } from './configuration/Configuration';
import { FlagManager } from './flag-manager/FlagManager';
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

  setNetworkAvailability(available: boolean): void;
}

export interface DataManagerFactory {
  (
    flagManager: FlagManager,
    configuration: Configuration,
    baseHeaders: LDHeaders,
    emitter: LDEmitter,
    diagnosticsManager?: internal.DiagnosticsManager,
  ): DataManager;
}

export class DefaultDataManager implements DataManager {
  protected updateProcessor?: subsystem.LDStreamProcessor;
  protected readonly logger: LDLogger;
  protected connectionMode: ConnectionMode = 'streaming';
  protected context?: Context;
  // Not implemented yet.
  protected networkAvailable: boolean = true;

  constructor(
    protected readonly platform: Platform,
    protected readonly flagManager: FlagManager,
    protected readonly credential: string,
    protected readonly config: Configuration,
    protected readonly getPollingPaths: () => DataSourcePaths,
    protected readonly getStreamingPaths: () => DataSourcePaths,
    protected readonly baseHeaders: LDHeaders,
    protected readonly emitter: LDEmitter,
    protected readonly diagnosticsManager?: internal.DiagnosticsManager,
  ) {
    this.logger = config.logger;
    this.connectionMode = config.initialConnectionMode;
  }

  setNetworkAvailability(available: boolean): void {
    this.networkAvailable = available;
  }

  async setConnectionMode(mode: ConnectionMode): Promise<void> {
    if (this.connectionMode === mode) {
      this.logger.debug(`setConnectionMode ignored. Mode is already '${mode}'.`);
      return;
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
  }

  async identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void> {
    this.context = context;
    const offline = this.connectionMode === 'offline';
    // In offline mode we do not support waiting for results.
    const waitForNetworkResults = !!identifyOptions?.waitForNetworkResults && !offline;

    const loadedFromCache = await this.flagManager.loadCached(context);
    if (loadedFromCache && !waitForNetworkResults) {
      this.logger.debug('Identify completing with cached flags');
      identifyResolve();
    }
    if (loadedFromCache && waitForNetworkResults) {
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

  protected setupConnection(
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

  protected createPollingProcessor(
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

  protected createStreamingProcessor(
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

  protected createStreamListeners(
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
