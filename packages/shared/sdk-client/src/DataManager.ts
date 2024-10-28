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
import DataSourceEventHandler from './datasource/DataSourceEventHandler';
import { DataSourceState } from './datasource/DataSourceStatus';
import DataSourceStatusManager from './datasource/DataSourceStatusManager';
import Requestor from './datasource/Requestor';
import { FlagManager } from './flag-manager/FlagManager';
import LDEmitter from './LDEmitter';
import PollingProcessor from './polling/PollingProcessor';
import { DataSourcePaths, StreamingProcessor } from './streaming';
import { DeleteFlag, Flags, PatchFlag } from './types';

export interface DataManager {
  /**
   * This function handles the data management aspects of the identification process.
   *
   * Implementation Note: The identifyResolve and identifyReject function resolve or reject the
   * identify function at LDClient level. It is likely in individual implementations that these
   * functions will be passed to other components, such as a datasource, do indicate when the
   * identify process has been completed. The data manager identify function should return once
   * everything has been set in motion to complete the identification process.
   *
   * @param identifyResolve Called to reject the identify operation.
   * @param identifyReject Called to complete the identify operation.
   * @param context The context being identified.
   * @param identifyOptions Options for identification.
   */
  identify(
    identifyResolve: () => void,
    identifyReject: (err: Error) => void,
    context: Context,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<void>;
}

/**
 * Factory interface for constructing data managers.
 */
export interface DataManagerFactory {
  (
    flagManager: FlagManager,
    configuration: Configuration,
    baseHeaders: LDHeaders,
    emitter: LDEmitter,
    diagnosticsManager?: internal.DiagnosticsManager,
  ): DataManager;
}

export interface ConnectionParams {
  queryParameters?: { key: string; value: string }[];
}

export abstract class BaseDataManager implements DataManager {
  protected updateProcessor?: subsystem.LDStreamProcessor;
  protected readonly logger: LDLogger;
  protected context?: Context;
  private _connectionParams?: ConnectionParams;
  protected readonly dataSourceStatusManager: DataSourceStatusManager;
  private readonly _dataSourceEventHandler: DataSourceEventHandler;

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
    this.dataSourceStatusManager = new DataSourceStatusManager(emitter);
    this._dataSourceEventHandler = new DataSourceEventHandler(
      flagManager,
      this.dataSourceStatusManager,
      this.config.logger,
    );
  }

  /**
   * Set additional connection parameters for requests polling/streaming.
   */
  protected setConnectionParams(connectionParams?: ConnectionParams) {
    this._connectionParams = connectionParams;
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
    requestor: Requestor,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
  ) {
    const processor = new PollingProcessor(
      requestor,
      this.config.pollInterval,
      async (flags) => {
        await this._dataSourceEventHandler.handlePut(checkedContext, flags);
        identifyResolve?.();
      },
      (err) => {
        this.emitter.emit('error', context, err);
        this._dataSourceEventHandler.handlePollingError(err);
        identifyReject?.(err);
      },
      this.logger,
    );

    this.updateProcessor = this._decorateProcessorWithStatusReporting(
      processor,
      this.dataSourceStatusManager,
    );
  }

  protected createStreamingProcessor(
    context: LDContext,
    checkedContext: Context,
    pollingRequestor: Requestor,
    identifyResolve?: () => void,
    identifyReject?: (err: Error) => void,
  ) {
    const processor = new StreamingProcessor(
      JSON.stringify(context),
      {
        credential: this.credential,
        serviceEndpoints: this.config.serviceEndpoints,
        paths: this.getStreamingPaths(),
        baseHeaders: this.baseHeaders,
        initialRetryDelayMillis: this.config.streamInitialReconnectDelay * 1000,
        withReasons: this.config.withReasons,
        useReport: this.config.useReport,
        queryParameters: this._connectionParams?.queryParameters,
      },
      this.createStreamListeners(checkedContext, identifyResolve),
      this.platform.requests,
      this.platform.encoding!,
      pollingRequestor,
      this.diagnosticsManager,
      (e) => {
        this.emitter.emit('error', context, e);
        this._dataSourceEventHandler.handleStreamingError(e);
        identifyReject?.(e);
      },
      this.logger,
    );

    this.updateProcessor = this._decorateProcessorWithStatusReporting(
      processor,
      this.dataSourceStatusManager,
    );
  }

  protected createStreamListeners(
    context: Context,
    identifyResolve?: () => void,
  ): Map<EventName, ProcessStreamResponse> {
    const listeners = new Map<EventName, ProcessStreamResponse>();

    listeners.set('put', {
      deserializeData: JSON.parse,
      processJson: async (flags: Flags) => {
        await this._dataSourceEventHandler.handlePut(context, flags);
        identifyResolve?.();
      },
    });

    listeners.set('patch', {
      deserializeData: JSON.parse,
      processJson: async (patchFlag: PatchFlag) => {
        this._dataSourceEventHandler.handlePatch(context, patchFlag);
      },
    });

    listeners.set('delete', {
      deserializeData: JSON.parse,
      processJson: async (deleteFlag: DeleteFlag) => {
        this._dataSourceEventHandler.handleDelete(context, deleteFlag);
      },
    });

    return listeners;
  }

  private _decorateProcessorWithStatusReporting(
    processor: subsystem.LDStreamProcessor,
    statusManager: DataSourceStatusManager,
  ): subsystem.LDStreamProcessor {
    return {
      start: () => {
        // update status before starting processor to ensure potential errors are reported after initializing
        statusManager.requestStateUpdate(DataSourceState.Initializing);
        processor.start();
      },
      stop: () => {
        processor.stop();
        statusManager.requestStateUpdate(DataSourceState.Closed);
      },
      close: () => {
        processor.close();
        statusManager.requestStateUpdate(DataSourceState.Closed);
      },
    };
  }
}
