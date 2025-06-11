import {
  CompositeDataSource,
  Context,
  internal,
  LDContext,
  LDHeaders,
  LDLogger,
  Platform,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import { LDIdentifyOptions } from './api/LDIdentifyOptions';
import { Configuration } from './configuration/Configuration';
import { ConnectionParams, DataManager } from './DataManager';
import DataSourceEventHandlerV2 from './datasource/DataSourceEventHandlerV2';
import DataSourceStatusManager from './datasource/DataSourceStatusManager';
import Requestor from './datasource/Requestor';
import { FlagManager } from './flag-manager/FlagManager';
import LDEmitter from './LDEmitter';
import { DataSourcePaths } from './streaming';
import StreamingProcessorFDv2 from './streaming/StreamingProcessorFDv2';
import { Flags } from './types';
import OneShotInitializerFDv2 from './polling/OneShotInitializerFDv2';

export abstract class BaseDataManagerV2 implements DataManager {
  protected dataSource?: subsystem.DataSource;
  protected readonly logger: LDLogger;
  protected context?: Context;
  private _connectionParams?: ConnectionParams;
  protected readonly dataSourceStatusManager: DataSourceStatusManager;
  private readonly _dataSourceEventHandler: DataSourceEventHandlerV2;
  protected closed = false;

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
    this._dataSourceEventHandler = new DataSourceEventHandlerV2(
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

  protected createOneShotDataSourceFactory(
    context: LDContext,
    checkedContext: Context,
    pollingRequestor: Requestor,
  ): subsystem.LDDataSourceFactory {
    return () => new OneShotInitializerFDv2(pollingRequestor, this.logger);
  }

  protected createStreamingDataSourceFactory(
    context: LDContext,
    checkedContext: Context,
    pingStreamRequestor: Requestor,
  ): subsystem.LDDataSourceFactory {
    return () =>
      new StreamingProcessorFDv2(
        JSON.stringify(context), // TODO: double check we actually want to be using the LDContext here, this seems wrong.
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
        this.platform.requests,
        this.platform.encoding!,
        pingStreamRequestor,
        this.diagnosticsManager,
        this.logger,
      );
  }

  protected createCompositeDataSource(
    initializers: subsystem.LDDataSourceFactory[],
    synchronizers: subsystem.LDDataSourceFactory[],
  ) {
    // TODO: hook up status reporting and validate composite datasource transitions are compatible
    // with existing client sdk API guarantees

    // this.updateProcessor = this._decorateProcessorWithStatusReporting(
    //   processor,
    //   this.dataSourceStatusManager,
    // );

    this.dataSource = new CompositeDataSource(initializers, synchronizers, [], this.logger);
  }

  protected createPayloadListener =
    (
      context: LDContext,
      checkedContext: Context,
      logger?: LDLogger,
      basisReceived: VoidFunction = () => {},
    ) =>
    async (payload: internal.Payload) => {
      if (payload.basis) {
        logger?.debug('Initializing all data');
      } else if (payload.updates.length > 0) {
        logger?.debug('Applying updates');
      } else {
        logger?.debug('Payload had no updates, ignoring.');
        return;
      }

      // convert updates to flags
      const converted: Flags = {};
      payload.updates.forEach((it: internal.Update) => {
        if (it.kind === 'flag') {
          converted[it.key] = {
            version: it.version,
            ...(it.deleted && { deleted: it.deleted }),
            ...it.object,
          };
        }

        if (it.deleted) {
          logger?.debug(`Deleting ${it.key} in ${it.kind}`);
        } else {
          logger?.debug(`Updating ${it.key} in ${it.kind}`);
        }
      });

      if (payload.basis) {
        basisReceived();
      }

      await this._dataSourceEventHandler.applyChanges(
        checkedContext,
        payload.basis,
        converted,
        // undefined, TODO: Support initMetadata in FDv2 datasources
        // payload.state, TODO: Support selector
      );
    };

  public close() {
    this.dataSource?.stop();
    this.closed = true;
  }
}
