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

export abstract class BaseDataManager implements DataManager {
  protected updateProcessor?: subsystem.LDStreamProcessor;
  protected readonly logger: LDLogger;
  protected context?: Context;

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
  }

  abstract identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void>;

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
