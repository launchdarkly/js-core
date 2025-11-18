/* eslint-disable class-methods-use-this */
import {
  cancelableTimedPromise,
  ClientContext,
  CompositeDataSource,
  Context,
  defaultHeaders,
  internal,
  LDClientError,
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDLogger,
  LDPluginEnvironmentMetadata,
  LDTimeoutError,
  Platform,
  subsystem,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

import {
  IsMigrationStage,
  LDClient,
  LDFeatureStore,
  LDFlagsState,
  LDFlagsStateOptions,
  LDMigrationOpEvent,
  LDMigrationStage,
  LDMigrationVariation,
  LDOptions,
  LDTransactionalFeatureStore,
} from './api';
import { Hook } from './api/integrations/Hook';
import { BigSegmentStoreMembership } from './api/interfaces';
import { LDWaitForInitializationOptions } from './api/LDWaitForInitializationOptions';
import {
  isPollingOnlyOptions,
  isStandardOptions,
  isStreamingOnlyOptions,
} from './api/options/LDDataSystemOptions';
import BigSegmentsManager from './BigSegmentsManager';
import BigSegmentStoreStatusProvider from './BigSegmentStatusProviderImpl';
import { createPluginEnvironmentMetadata } from './createPluginEnvironmentMetadata';
import { createPayloadListener } from './data_sources/createPayloadListenerFDv2';
import { createStreamListeners } from './data_sources/createStreamListeners';
import DataSourceUpdates from './data_sources/DataSourceUpdates';
import FileDataInitializerFDv2 from './data_sources/fileDataInitilizerFDv2';
import OneShotInitializerFDv2 from './data_sources/OneShotInitializerFDv2';
import PollingProcessor from './data_sources/PollingProcessor';
import PollingProcessorFDv2 from './data_sources/PollingProcessorFDv2';
import Requestor from './data_sources/Requestor';
import StreamingProcessor from './data_sources/StreamingProcessor';
import StreamingProcessorFDv2 from './data_sources/StreamingProcessorFDv2';
import TransactionalDataSourceUpdates from './data_sources/TransactionalDataSourceUpdates';
import createDiagnosticsInitConfig from './diagnostics/createDiagnosticsInitConfig';
import { allAsync } from './evaluation/collection';
import { Flag } from './evaluation/data/Flag';
import { Segment } from './evaluation/data/Segment';
import EvalResult from './evaluation/EvalResult';
import Evaluator from './evaluation/Evaluator';
import { Queries } from './evaluation/Queries';
import ContextDeduplicator from './events/ContextDeduplicator';
import EventFactory from './events/EventFactory';
import isExperiment from './events/isExperiment';
import FlagsStateBuilder from './FlagsStateBuilder';
import HookRunner from './hooks/HookRunner';
import MigrationOpEventToInputEvent from './MigrationOpEventConversion';
import MigrationOpTracker from './MigrationOpTracker';
import Configuration, { DEFAULT_POLL_INTERVAL } from './options/Configuration';
import { ServerInternalOptions } from './options/ServerInternalOptions';
import VersionedDataKinds from './store/VersionedDataKinds';

const { ClientMessages, ErrorKinds, NullEventProcessor } = internal;
enum InitState {
  Initializing,
  Initialized,
  Failed,
}

const HIGH_TIMEOUT_THRESHOLD: number = 60;

export interface LDClientCallbacks {
  onError: (err: Error) => void;
  onFailed: (err: Error) => void;
  onReady: () => void;
  // Called whenever flags change, if there are listeners.
  onUpdate: (key: string) => void;
  // Method to check if event listeners have been registered.
  // If none are registered, then onUpdate will never be called.
  hasEventListeners: () => boolean;
}

const BOOL_VARIATION_METHOD_NAME = 'LDClient.boolVariation';
const NUMBER_VARIATION_METHOD_NAME = 'LDClient.numberVariation';
const STRING_VARIATION_METHOD_NAME = 'LDClient.stringVariation';
const JSON_VARIATION_METHOD_NAME = 'LDClient.jsonVariation';
const VARIATION_METHOD_NAME = 'LDClient.variation';
const MIGRATION_VARIATION_METHOD_NAME = 'LDClient.migrationVariation';

const BOOL_VARIATION_DETAIL_METHOD_NAME = 'LDClient.boolVariationDetail';
const NUMBER_VARIATION_DETAIL_METHOD_NAME = 'LDClient.numberVariationDetail';
const STRING_VARIATION_DETAIL_METHOD_NAME = 'LDClient.stringVariationDetail';
const JSON_VARIATION_DETAIL_METHOD_NAME = 'LDClient.jsonVariationDetail';
const VARIATION_METHOD_DETAIL_NAME = 'LDClient.variationDetail';

function constructFDv1(
  sdkKey: string,
  platform: Platform,
  config: Configuration,
  callbacks: LDClientCallbacks,
  initSuccess: () => void,
  dataSourceErrorHandler: (e: any) => void,
  hooks: Hook[],
): {
  config: Configuration;
  logger: LDLogger | undefined;
  evaluator: Evaluator;
  featureStore: LDFeatureStore;
  updateProcessor: subsystem.LDStreamProcessor | undefined;
  eventProcessor: subsystem.LDEventProcessor;
  bigSegmentsManager: BigSegmentsManager;
  hookRunner: HookRunner;
  onError: (err: Error) => void;
  onFailed: (err: Error) => void;
  onReady: () => void;
} {
  const { onUpdate, hasEventListeners } = callbacks;

  const hookRunner = new HookRunner(config.logger, hooks);

  if (!sdkKey && !config.offline) {
    throw new Error('You must configure the client with an SDK key');
  }
  const { logger } = config;
  const baseHeaders = defaultHeaders(sdkKey, platform.info, config.tags);

  const clientContext = new ClientContext(sdkKey, config, platform);
  const featureStore = config.featureStoreFactory(clientContext);

  const dataSourceUpdates = new DataSourceUpdates(featureStore, hasEventListeners, onUpdate);

  let diagnosticsManager: internal.DiagnosticsManager | undefined;
  if (config.sendEvents && !config.offline && !config.diagnosticOptOut) {
    diagnosticsManager = new internal.DiagnosticsManager(
      sdkKey,
      platform,
      createDiagnosticsInitConfig(config, platform, featureStore),
    );
  }

  let eventProcessor: subsystem.LDEventProcessor;
  if (!config.sendEvents || config.offline) {
    eventProcessor = new NullEventProcessor();
  } else {
    eventProcessor = new internal.EventProcessor(
      config,
      clientContext,
      baseHeaders,
      new ContextDeduplicator(config),
      diagnosticsManager,
    );
  }

  const bigSegmentsManager = new BigSegmentsManager(
    config.bigSegments?.store?.(clientContext),
    config.bigSegments ?? {},
    config.logger,
    platform.crypto,
  );

  const queries: Queries = {
    getFlag(key: string, cb: (flag: Flag | undefined) => void): void {
      featureStore.get(VersionedDataKinds.Features, key, (item) => cb(item as Flag));
    },
    getSegment(key: string, cb: (segment: Segment | undefined) => void): void {
      featureStore.get(VersionedDataKinds.Segments, key, (item) => cb(item as Segment));
    },
    getBigSegmentsMembership(
      userKey: string,
    ): Promise<[BigSegmentStoreMembership | null, string] | undefined> {
      return bigSegmentsManager.getUserMembership(userKey);
    },
  };
  const evaluator = new Evaluator(platform, queries);

  const listeners = createStreamListeners(dataSourceUpdates, logger, {
    put: initSuccess,
  });
  const makeDefaultProcessor = () =>
    config.stream
      ? new StreamingProcessor(
          clientContext,
          '/all',
          [],
          listeners,
          baseHeaders,
          diagnosticsManager,
          dataSourceErrorHandler,
          config.streamInitialReconnectDelay,
        )
      : new PollingProcessor(
          new Requestor(config, platform.requests, baseHeaders),
          config.pollInterval,
          dataSourceUpdates,
          config.logger,
          initSuccess,
          dataSourceErrorHandler,
        );

  let updateProcessor: subsystem.LDStreamProcessor | undefined;
  if (!(config.offline || config.useLdd)) {
    updateProcessor =
      config.updateProcessorFactory?.(
        clientContext,
        dataSourceUpdates,
        initSuccess,
        dataSourceErrorHandler,
      ) ?? makeDefaultProcessor();
  }

  return {
    config,
    logger,
    evaluator,
    featureStore,
    updateProcessor,
    eventProcessor,
    bigSegmentsManager,
    hookRunner,
    onError: callbacks.onError,
    onFailed: callbacks.onFailed,
    onReady: callbacks.onReady,
  };
}

function constructFDv2(
  sdkKey: string,
  platform: Platform,
  config: Configuration,
  callbacks: LDClientCallbacks,
  initSuccess: () => void,
  hooks: Hook[],
): {
  config: Configuration;
  logger: LDLogger | undefined;
  evaluator: Evaluator;
  featureStore: LDTransactionalFeatureStore;
  dataSource: subsystem.DataSource | undefined;
  payloadListener: ((payload: any) => void) | undefined;
  eventProcessor: subsystem.LDEventProcessor;
  bigSegmentsManager: BigSegmentsManager;
  hookRunner: HookRunner;
  onError: (err: Error) => void;
  onFailed: (err: Error) => void;
  onReady: () => void;
} {
  const { onUpdate, hasEventListeners } = callbacks;

  const hookRunner = new HookRunner(config.logger, hooks);

  if (!sdkKey && !config.offline) {
    throw new Error('You must configure the client with an SDK key');
  }

  const { logger } = config;
  const baseHeaders = defaultHeaders(sdkKey, platform.info, config.tags);

  const clientContext = new ClientContext(sdkKey, config, platform);
  const dataSystem = config.dataSystem!; // dataSystem must be defined to get into this construct function
  const featureStore = dataSystem.featureStoreFactory(clientContext);

  const dataSourceUpdates = new TransactionalDataSourceUpdates(
    featureStore,
    hasEventListeners,
    onUpdate,
  );

  let diagnosticsManager: internal.DiagnosticsManager | undefined;
  if (config.sendEvents && !config.offline && !config.diagnosticOptOut) {
    diagnosticsManager = new internal.DiagnosticsManager(
      sdkKey,
      platform,
      createDiagnosticsInitConfig(config, platform, featureStore),
    );
  }

  let eventProcessor: internal.NullEventProcessor | internal.EventProcessor;
  if (!config.sendEvents || config.offline) {
    eventProcessor = new NullEventProcessor();
  } else {
    eventProcessor = new internal.EventProcessor(
      config,
      clientContext,
      baseHeaders,
      new ContextDeduplicator(config),
      diagnosticsManager,
    );
  }

  const bigSegmentsManager = new BigSegmentsManager(
    config.bigSegments?.store?.(clientContext),
    config.bigSegments ?? {},
    config.logger,
    platform.crypto,
  );

  const queries: Queries = {
    getFlag(key: string, cb: (flag: Flag | undefined) => void): void {
      featureStore.get(VersionedDataKinds.Features, key, (item) => cb(item as Flag));
    },
    getSegment(key: string, cb: (segment: Segment | undefined) => void): void {
      featureStore.get(VersionedDataKinds.Segments, key, (item) => cb(item as Segment));
    },
    getBigSegmentsMembership(
      userKey: string,
    ): Promise<[BigSegmentStoreMembership | null, string] | undefined> {
      return bigSegmentsManager.getUserMembership(userKey);
    },
  };
  const evaluator = new Evaluator(platform, queries);

  let dataSource: subsystem.DataSource | undefined;
  let payloadListener: ((payload: any) => void) | undefined;
  if (!(config.offline || config.dataSystem!.useLdd)) {
    // make the FDv2 composite datasource with initializers/synchronizers
    const initializers: subsystem.LDDataSourceFactory[] = [];

    // use one shot initializer for performance and cost if we can do a combination of polling and streaming
    if (dataSystem.dataSource?.initializerOptions?.type === 'polling') {
      initializers.push(
        () =>
          new OneShotInitializerFDv2(
            new Requestor(config, platform.requests, baseHeaders, '/sdk/poll', config.logger),
            config.logger,
          ),
      );
    } else if (dataSystem.dataSource?.initializerOptions?.type === 'file') {
      initializers.push(() => new FileDataInitializerFDv2(config, platform));
    }

    const synchronizers: subsystem.LDDataSourceFactory[] = [];
    // if streaming is configured, add streaming synchronizer
    if (isStandardOptions(dataSystem.dataSource) || isStreamingOnlyOptions(dataSystem.dataSource)) {
      const reconnectDelay = dataSystem.dataSource.streamInitialReconnectDelay;
      synchronizers.push(
        () =>
          new StreamingProcessorFDv2(
            clientContext,
            '/sdk/stream',
            [],
            baseHeaders,
            diagnosticsManager,
            reconnectDelay,
          ),
      );
    }

    let pollingInterval = DEFAULT_POLL_INTERVAL;
    // if polling is configured, add polling synchronizer
    if (isStandardOptions(dataSystem.dataSource) || isPollingOnlyOptions(dataSystem.dataSource)) {
      pollingInterval = dataSystem.dataSource.pollInterval ?? DEFAULT_POLL_INTERVAL;
      synchronizers.push(
        () =>
          new PollingProcessorFDv2(
            new Requestor(config, platform.requests, baseHeaders, '/sdk/poll', logger),
            pollingInterval,
            logger,
          ),
      );
    }

    // This is short term handling and will be removed once FDv2 adoption is sufficient.
    const fdv1FallbackSynchronizers = [
      () =>
        new PollingProcessorFDv2(
          new Requestor(config, platform.requests, baseHeaders, '/sdk/latest-all', config.logger),
          pollingInterval,
          config.logger,
          true,
        ),
    ];

    dataSource = new CompositeDataSource(
      initializers,
      synchronizers,
      fdv1FallbackSynchronizers,
      logger,
    );
    payloadListener = createPayloadListener(dataSourceUpdates, logger, initSuccess);
  }

  return {
    config,
    logger,
    evaluator,
    featureStore,
    dataSource,
    payloadListener,
    eventProcessor,
    bigSegmentsManager,
    hookRunner,
    onError: callbacks.onError,
    onFailed: callbacks.onFailed,
    onReady: callbacks.onReady,
  };
}

/**
 * @ignore
 */
export default class LDClientImpl implements LDClient {
  private _initState: InitState = InitState.Initializing;

  private _featureStore: LDFeatureStore | LDTransactionalFeatureStore;

  private _updateProcessor?: subsystem.LDStreamProcessor;

  private _dataSource?: subsystem.DataSource;

  private _eventFactoryDefault = new EventFactory(false);

  private _eventFactoryWithReasons = new EventFactory(true);

  private _eventProcessor: subsystem.LDEventProcessor;

  private _evaluator: Evaluator;

  private _initResolve?: (value: LDClient | PromiseLike<LDClient>) => void;

  private _initReject?: (err: Error) => void;

  private _rejectionReason: Error | undefined;

  private _initializedPromise?: Promise<LDClient>;

  private _logger?: LDLogger;

  private _config: Configuration;

  private _bigSegmentsManager: BigSegmentsManager;

  private _onError: (err: Error) => void;

  private _onFailed: (err: Error) => void;

  private _onReady: () => void;

  private _hookRunner: HookRunner;

  /**
   * Derived classes need to use this data to register plugins.
   */
  protected environmentMetadata: LDPluginEnvironmentMetadata;

  public get logger(): LDLogger | undefined {
    return this._logger;
  }

  /**
   * Intended for use by platform specific client implementations.
   *
   * It is not included in the main interface because it requires the use of
   * a platform event system. For node this would be an EventEmitter, for other
   * platforms it would likely be an EventTarget.
   */
  protected bigSegmentStatusProviderInternal: BigSegmentStoreStatusProvider;

  constructor(
    private _sdkKey: string,
    private _platform: Platform,
    options: LDOptions,
    callbacks: LDClientCallbacks,
    internalOptions?: ServerInternalOptions,
  ) {
    const config = new Configuration(options, internalOptions);

    this.environmentMetadata = createPluginEnvironmentMetadata(_platform, _sdkKey, config);

    const hooks: Hook[] = [];
    if (config.hooks) {
      hooks.push(...config.hooks);
    }
    config.getImplementationHooks(this.environmentMetadata).forEach((hook) => {
      hooks.push(hook);
    });

    if (!config.dataSystem) {
      // setup for FDv1
      ({
        config: this._config,
        logger: this._logger,
        evaluator: this._evaluator,
        featureStore: this._featureStore,
        updateProcessor: this._updateProcessor,
        eventProcessor: this._eventProcessor,
        bigSegmentsManager: this._bigSegmentsManager,
        hookRunner: this._hookRunner,
        onError: this._onError,
        onFailed: this._onFailed,
        onReady: this._onReady,
      } = constructFDv1(
        _sdkKey,
        _platform,
        config,
        callbacks,
        () => this._initSuccess(),
        (e) => this._dataSourceErrorHandler(e),
        hooks,
      ));

      this.bigSegmentStatusProviderInternal = this._bigSegmentsManager
        .statusProvider as BigSegmentStoreStatusProvider;

      if (this._updateProcessor) {
        this._updateProcessor.start();
      } else {
        // Deferring the start callback should allow client construction to complete before we start
        // emitting events. Allowing the client an opportunity to register events.
        setTimeout(() => this._initSuccess(), 0);
      }
    } else {
      // setup for FDv2
      let transactionalStore: LDTransactionalFeatureStore;
      let payloadListener: ((payload: any) => void) | undefined;
      ({
        config: this._config,
        logger: this._logger,
        evaluator: this._evaluator,
        featureStore: transactionalStore,
        dataSource: this._dataSource,
        payloadListener,
        eventProcessor: this._eventProcessor,
        bigSegmentsManager: this._bigSegmentsManager,
        hookRunner: this._hookRunner,
        onError: this._onError,
        onFailed: this._onFailed,
        onReady: this._onReady,
      } = constructFDv2(_sdkKey, _platform, config, callbacks, () => this._initSuccess(), hooks));
      this._featureStore = transactionalStore;
      this.bigSegmentStatusProviderInternal = this._bigSegmentsManager
        .statusProvider as BigSegmentStoreStatusProvider;

      if (this._dataSource) {
        this._dataSource.start(
          (_, payload) => {
            payloadListener?.(payload);
          },
          (state, err) => {
            if (state === subsystem.DataSourceState.Closed && err) {
              this._dataSourceErrorHandler(err);
            }
          },
          () => transactionalStore.getSelector?.(),
        );
      } else {
        // Deferring the start callback should allow client construction to complete before we start
        // emitting events. Allowing the client an opportunity to register events.
        setTimeout(() => this._initSuccess(), 0);
      }
    }
  }

  initialized(): boolean {
    return this._initState === InitState.Initialized;
  }

  waitForInitialization(options?: LDWaitForInitializationOptions): Promise<LDClient> {
    // An initialization promise is only created if someone is going to use that promise.
    // If we always created an initialization promise, and there was no call waitForInitialization
    // by the time the promise was rejected, then that would result in an unhandled promise
    // rejection.

    // If there is no update processor, then there is functionally no initialization
    // so it is fine not to wait.

    if (
      options?.timeout === undefined &&
      (this._updateProcessor !== undefined || this._dataSource !== undefined)
    ) {
      this._logger?.warn(
        'The waitForInitialization function was called without a timeout specified.' +
          ' In a future version a default timeout will be applied.',
      );
    }
    if (
      options?.timeout !== undefined &&
      options?.timeout > HIGH_TIMEOUT_THRESHOLD &&
      (this._updateProcessor !== undefined || this._dataSource !== undefined)
    ) {
      this._logger?.warn(
        'The waitForInitialization function was called with a timeout greater than ' +
          `${HIGH_TIMEOUT_THRESHOLD} seconds. We recommend a timeout of less than ` +
          `${HIGH_TIMEOUT_THRESHOLD} seconds.`,
      );
    }

    // Initialization promise was created by a previous call to waitForInitialization.
    if (this._initializedPromise) {
      // This promise may already be resolved/rejected, but it doesn't hurt to wrap it in a timeout.
      return this._clientWithTimeout(this._initializedPromise, options?.timeout, this._logger);
    }

    // Initialization completed before waitForInitialization was called, so we have completed
    // and there was no promise. So we make a resolved promise and return it.
    if (this._initState === InitState.Initialized) {
      this._initializedPromise = Promise.resolve(this);
      // Already initialized, no need to timeout.
      return this._initializedPromise;
    }

    // Initialization failed before waitForInitialization was called, so we have completed
    // and there was no promise. So we make a rejected promise and return it.
    if (this._initState === InitState.Failed) {
      // Already failed, no need to timeout.
      this._initializedPromise = Promise.reject(this._rejectionReason);
      return this._initializedPromise;
    }

    if (!this._initializedPromise) {
      this._initializedPromise = new Promise((resolve, reject) => {
        this._initResolve = resolve;
        this._initReject = reject;
      });
    }
    return this._clientWithTimeout(this._initializedPromise, options?.timeout, this._logger);
  }

  variation(
    key: string,
    context: LDContext,
    defaultValue: any,
    callback?: (err: any, res: any) => void,
  ): Promise<any> {
    return this._hookRunner
      .withEvaluationSeries(
        key,
        context,
        defaultValue,
        VARIATION_METHOD_NAME,
        () =>
          new Promise<LDEvaluationDetail>((resolve) => {
            this._evaluateIfPossible(
              key,
              context,
              defaultValue,
              this._eventFactoryDefault,
              (res) => {
                resolve(res.detail);
              },
            );
          }),
        this._featureStore.getInitMetaData?.()?.environmentId,
      )
      .then((detail) => {
        callback?.(null, detail.value);
        return detail.value;
      });
  }

  variationDetail(
    key: string,
    context: LDContext,
    defaultValue: any,
    callback?: (err: any, res: LDEvaluationDetail) => void,
  ): Promise<LDEvaluationDetail> {
    return this._hookRunner.withEvaluationSeries(
      key,
      context,
      defaultValue,
      VARIATION_METHOD_DETAIL_NAME,
      () =>
        new Promise<LDEvaluationDetail>((resolve) => {
          this._evaluateIfPossible(
            key,
            context,
            defaultValue,
            this._eventFactoryWithReasons,
            (res) => {
              resolve(res.detail);
              callback?.(null, res.detail);
            },
          );
        }),
      this._featureStore.getInitMetaData?.()?.environmentId,
    );
  }

  private _typedEval<TResult>(
    key: string,
    context: LDContext,
    defaultValue: TResult,
    eventFactory: EventFactory,
    methodName: string,
    typeChecker: (value: unknown) => [boolean, string],
  ): Promise<LDEvaluationDetail> {
    return this._hookRunner.withEvaluationSeries(
      key,
      context,
      defaultValue,
      methodName,
      () =>
        new Promise<LDEvaluationDetailTyped<TResult>>((resolve) => {
          this._evaluateIfPossible(
            key,
            context,
            defaultValue,
            eventFactory,
            (res) => {
              const typedRes: LDEvaluationDetailTyped<TResult> = {
                value: res.detail.value as TResult,
                reason: res.detail.reason,
                variationIndex: res.detail.variationIndex,
              };
              resolve(typedRes);
            },
            typeChecker,
          );
        }),
      this._featureStore.getInitMetaData?.()?.environmentId,
    );
  }

  async boolVariation(key: string, context: LDContext, defaultValue: boolean): Promise<boolean> {
    return (
      await this._typedEval(
        key,
        context,
        defaultValue,
        this._eventFactoryDefault,
        BOOL_VARIATION_METHOD_NAME,
        (value) => [TypeValidators.Boolean.is(value), TypeValidators.Boolean.getType()],
      )
    ).value;
  }

  async numberVariation(key: string, context: LDContext, defaultValue: number): Promise<number> {
    return (
      await this._typedEval(
        key,
        context,
        defaultValue,
        this._eventFactoryDefault,
        NUMBER_VARIATION_METHOD_NAME,
        (value) => [TypeValidators.Number.is(value), TypeValidators.Number.getType()],
      )
    ).value;
  }

  async stringVariation(key: string, context: LDContext, defaultValue: string): Promise<string> {
    return (
      await this._typedEval(
        key,
        context,
        defaultValue,
        this._eventFactoryDefault,
        STRING_VARIATION_METHOD_NAME,
        (value) => [TypeValidators.String.is(value), TypeValidators.String.getType()],
      )
    ).value;
  }

  jsonVariation(key: string, context: LDContext, defaultValue: unknown): Promise<unknown> {
    return this._hookRunner
      .withEvaluationSeries(
        key,
        context,
        defaultValue,
        JSON_VARIATION_METHOD_NAME,
        () =>
          new Promise<LDEvaluationDetail>((resolve) => {
            this._evaluateIfPossible(
              key,
              context,
              defaultValue,
              this._eventFactoryDefault,
              (res) => {
                resolve(res.detail);
              },
            );
          }),
        this._featureStore.getInitMetaData?.()?.environmentId,
      )
      .then((detail) => detail.value);
  }

  boolVariationDetail(
    key: string,
    context: LDContext,
    defaultValue: boolean,
  ): Promise<LDEvaluationDetailTyped<boolean>> {
    return this._typedEval(
      key,
      context,
      defaultValue,
      this._eventFactoryWithReasons,
      BOOL_VARIATION_DETAIL_METHOD_NAME,
      (value) => [TypeValidators.Boolean.is(value), TypeValidators.Boolean.getType()],
    );
  }

  numberVariationDetail(
    key: string,
    context: LDContext,
    defaultValue: number,
  ): Promise<LDEvaluationDetailTyped<number>> {
    return this._typedEval(
      key,
      context,
      defaultValue,
      this._eventFactoryWithReasons,
      NUMBER_VARIATION_DETAIL_METHOD_NAME,
      (value) => [TypeValidators.Number.is(value), TypeValidators.Number.getType()],
    );
  }

  stringVariationDetail(
    key: string,
    context: LDContext,
    defaultValue: string,
  ): Promise<LDEvaluationDetailTyped<string>> {
    return this._typedEval(
      key,
      context,
      defaultValue,
      this._eventFactoryWithReasons,
      STRING_VARIATION_DETAIL_METHOD_NAME,
      (value) => [TypeValidators.String.is(value), TypeValidators.String.getType()],
    );
  }

  jsonVariationDetail(
    key: string,
    context: LDContext,
    defaultValue: unknown,
  ): Promise<LDEvaluationDetailTyped<unknown>> {
    return this._hookRunner.withEvaluationSeries(
      key,
      context,
      defaultValue,
      JSON_VARIATION_DETAIL_METHOD_NAME,
      () =>
        new Promise<LDEvaluationDetail>((resolve) => {
          this._evaluateIfPossible(
            key,
            context,
            defaultValue,
            this._eventFactoryWithReasons,
            (res) => {
              resolve(res.detail);
            },
          );
        }),
      this._featureStore.getInitMetaData?.()?.environmentId,
    );
  }

  private async _migrationVariationInternal(
    key: string,
    context: LDContext,
    defaultValue: LDMigrationStage,
  ): Promise<{ detail: LDEvaluationDetail; migration: LDMigrationVariation }> {
    const res = await new Promise<{ detail: LDEvaluationDetail; flag?: Flag }>((resolve) => {
      this._evaluateIfPossible(
        key,
        context,
        defaultValue,
        this._eventFactoryWithReasons,
        ({ detail }, flag) => {
          if (!IsMigrationStage(detail.value)) {
            const error = new Error(
              `Unrecognized MigrationState for "${key}"; returning default value.`,
            );
            this._onError(error);
            const reason = {
              kind: 'ERROR',
              errorKind: ErrorKinds.WrongType,
            };
            resolve({
              detail: {
                value: defaultValue,
                reason,
              },
              flag,
            });
            return;
          }
          resolve({ detail, flag });
        },
      );
    });

    const { detail, flag } = res;
    const checkRatio = flag?.migration?.checkRatio;
    const samplingRatio = flag?.samplingRatio;

    return {
      detail,
      migration: {
        value: detail.value as LDMigrationStage,
        tracker: new MigrationOpTracker(
          key,
          context,
          defaultValue,
          detail.value,
          detail.reason,
          checkRatio,
          // Can be null for compatibility reasons.
          detail.variationIndex === null ? undefined : detail.variationIndex,
          flag?.version,
          samplingRatio,
          this._logger,
        ),
      },
    };
  }

  async migrationVariation(
    key: string,
    context: LDContext,
    defaultValue: LDMigrationStage,
  ): Promise<LDMigrationVariation> {
    const res = await this._hookRunner.withEvaluationSeriesExtraDetail(
      key,
      context,
      defaultValue,
      MIGRATION_VARIATION_METHOD_NAME,
      () => this._migrationVariationInternal(key, context, defaultValue),
      this._featureStore.getInitMetaData?.()?.environmentId,
    );

    return res.migration;
  }

  allFlagsState(
    context: LDContext,
    options?: LDFlagsStateOptions,
    callback?: (err: Error | null, res: LDFlagsState) => void,
  ): Promise<LDFlagsState> {
    if (this._config.offline) {
      this._logger?.info('allFlagsState() called in offline mode. Returning empty state.');
      const allFlagState = new FlagsStateBuilder(false, false).build();
      callback?.(null, allFlagState);
      return Promise.resolve(allFlagState);
    }

    const evalContext = Context.fromLDContext(context);
    if (!evalContext.valid) {
      this._logger?.info(`${evalContext.message ?? 'Invalid context.'}. Returning empty state.`);
      return Promise.resolve(new FlagsStateBuilder(false, false).build());
    }

    return new Promise<LDFlagsState>((resolve) => {
      const doEval = (valid: boolean) =>
        this._featureStore.all(VersionedDataKinds.Features, (allFlags) => {
          const builder = new FlagsStateBuilder(valid, !!options?.withReasons);
          const clientOnly = !!options?.clientSideOnly;
          const detailsOnlyIfTracked = !!options?.detailsOnlyForTrackedFlags;

          allAsync(
            Object.values(allFlags),
            (storeItem, iterCb) => {
              const flag = storeItem as Flag;
              if (clientOnly && !flag.clientSideAvailability?.usingEnvironmentId) {
                iterCb(true);
                return;
              }
              this._evaluator.evaluateCb(flag, evalContext, (res) => {
                if (res.isError) {
                  this._onError(
                    new Error(
                      `Error for feature flag "${flag.key}" while evaluating all flags: ${res.message}`,
                    ),
                  );
                }
                const requireExperimentData = isExperiment(flag, res.detail.reason);
                builder.addFlag(
                  flag,
                  res.detail.value,
                  res.detail.variationIndex ?? undefined,
                  res.detail.reason,
                  flag.trackEvents || requireExperimentData,
                  requireExperimentData,
                  detailsOnlyIfTracked,
                  res.prerequisites,
                );
                iterCb(true);
              });
            },
            () => {
              const res = builder.build();
              callback?.(null, res);
              resolve(res);
            },
          );
        });
      if (!this.initialized()) {
        this._featureStore.initialized((storeInitialized) => {
          let valid = true;
          if (storeInitialized) {
            this._logger?.warn(
              'Called allFlagsState before client initialization; using last known' +
                ' values from data store',
            );
          } else {
            this._logger?.warn(
              'Called allFlagsState before client initialization. Data store not available; ' +
                'returning empty state',
            );
            valid = false;
          }
          doEval(valid);
        });
      } else {
        doEval(true);
      }
    });
  }

  secureModeHash(context: LDContext): string {
    const checkedContext = Context.fromLDContext(context);
    const key = checkedContext.valid ? checkedContext.canonicalKey : undefined;
    if (!this._platform.crypto.createHmac) {
      // This represents an error in platform implementation.
      throw new Error('Platform must implement createHmac');
    }
    const hmac = this._platform.crypto.createHmac('sha256', this._sdkKey);

    if (key === undefined) {
      throw new LDClientError('Could not generate secure mode hash for invalid context');
    }
    hmac.update(key);
    return hmac.digest('hex');
  }

  close(): void {
    this._eventProcessor.close();
    this._updateProcessor?.close();
    this._dataSource?.stop();
    this._featureStore.close();
    this._bigSegmentsManager.close();
  }

  isOffline(): boolean {
    return this._config.offline;
  }

  track(key: string, context: LDContext, data?: any, metricValue?: number): void {
    const checkedContext = Context.fromLDContext(context);
    if (!checkedContext.valid) {
      this._logger?.warn(ClientMessages.MissingContextKeyNoEvent);
      return;
    }

    // 0 is valid, so do not truthy check the metric value
    if (metricValue !== undefined && !TypeValidators.Number.is(metricValue)) {
      this._logger?.warn(ClientMessages.invalidMetricValue(typeof metricValue));
    }

    this._eventProcessor.sendEvent(
      this._eventFactoryDefault.customEvent(key, checkedContext!, data, metricValue),
    );
  }

  trackMigration(event: LDMigrationOpEvent): void {
    const converted = MigrationOpEventToInputEvent(event);
    if (!converted) {
      return;
    }

    this._eventProcessor.sendEvent(converted);
  }

  identify(context: LDContext): void {
    const checkedContext = Context.fromLDContext(context);
    if (!checkedContext.valid) {
      this._logger?.warn(ClientMessages.MissingContextKeyNoEvent);
      return;
    }
    this._eventProcessor.sendEvent(this._eventFactoryDefault.identifyEvent(checkedContext!));
  }

  async flush(callback?: (err: Error | null, res: boolean) => void): Promise<void> {
    try {
      await this._eventProcessor.flush();
    } catch (err) {
      return callback?.(err as Error, false);
    }
    return callback?.(null, true);
  }

  addHook(hook: Hook): void {
    this._hookRunner.addHook(hook);
  }

  private _variationInternal(
    flagKey: string,
    context: LDContext,
    defaultValue: any,
    eventFactory: EventFactory,
    cb: (res: EvalResult, flag?: Flag) => void,
    typeChecker?: (value: any) => [boolean, string],
  ): void {
    if (this._config.offline) {
      this._logger?.info('Variation called in offline mode. Returning default value.');
      cb(EvalResult.forError(ErrorKinds.ClientNotReady, undefined, defaultValue));
      return;
    }
    const evalContext = Context.fromLDContext(context);
    if (!evalContext.valid) {
      this._onError(
        new LDClientError(
          `${evalContext.message ?? 'Context not valid;'} returning default value.`,
        ),
      );
      cb(EvalResult.forError(ErrorKinds.UserNotSpecified, undefined, defaultValue));
      return;
    }

    this._featureStore.get(VersionedDataKinds.Features, flagKey, (item) => {
      const flag = item as Flag;
      if (!flag) {
        const error = new LDClientError(
          `Unknown feature flag "${flagKey}"; returning default value`,
        );
        this._onError(error);
        const result = EvalResult.forError(ErrorKinds.FlagNotFound, undefined, defaultValue);
        this._eventProcessor.sendEvent(
          this._eventFactoryDefault.unknownFlagEvent(flagKey, defaultValue, evalContext),
        );
        cb(result);
        return;
      }
      this._evaluator.evaluateCb(
        flag,
        evalContext,
        (evalRes) => {
          if (
            evalRes.detail.variationIndex === undefined ||
            evalRes.detail.variationIndex === null
          ) {
            this._logger?.debug('Result value is null in variation');
            evalRes.setDefault(defaultValue);
          }

          if (typeChecker) {
            const [matched, type] = typeChecker(evalRes.detail.value);
            if (!matched) {
              const errorRes = EvalResult.forError(
                ErrorKinds.WrongType,
                `Did not receive expected type (${type}) evaluating feature flag "${flagKey}"`,
                defaultValue,
              );
              this._sendEvalEvent(errorRes, eventFactory, flag, evalContext, defaultValue);
              cb(errorRes, flag);
              return;
            }
          }

          this._sendEvalEvent(evalRes, eventFactory, flag, evalContext, defaultValue);
          cb(evalRes, flag);
        },
        eventFactory,
      );
    });
  }

  private _sendEvalEvent(
    evalRes: EvalResult,
    eventFactory: EventFactory,
    flag: Flag,
    evalContext: Context,
    defaultValue: any,
  ) {
    evalRes.events?.forEach((event) => {
      this._eventProcessor.sendEvent({ ...event });
    });
    this._eventProcessor.sendEvent(
      eventFactory.evalEventServer(flag, evalContext, evalRes.detail, defaultValue, undefined),
    );
  }

  private _evaluateIfPossible(
    flagKey: string,
    context: LDContext,
    defaultValue: any,
    eventFactory: EventFactory,
    cb: (res: EvalResult, flag?: Flag) => void,
    typeChecker?: (value: any) => [boolean, string],
  ): void {
    if (!this.initialized()) {
      this._featureStore.initialized((storeInitialized) => {
        if (storeInitialized) {
          this._logger?.warn(
            'Variation called before LaunchDarkly client initialization completed' +
              " (did you wait for the 'ready' event?) - using last known values from feature store",
          );
          this._variationInternal(flagKey, context, defaultValue, eventFactory, cb, typeChecker);
          return;
        }
        this._logger?.warn(
          'Variation called before LaunchDarkly client initialization completed (did you wait for the' +
            "'ready' event?) - using default value",
        );
        cb(EvalResult.forError(ErrorKinds.ClientNotReady, undefined, defaultValue));
      });
      return;
    }
    this._variationInternal(flagKey, context, defaultValue, eventFactory, cb, typeChecker);
  }

  private _dataSourceErrorHandler(e: any) {
    const error =
      e.code === 401 ? new Error('Authentication failed. Double check your SDK key.') : e;

    this._onError(error);
    this._onFailed(error);

    if (!this.initialized()) {
      this._initState = InitState.Failed;
      this._rejectionReason = error;
      this._initReject?.(error);
    }
  }

  private _initSuccess() {
    if (!this.initialized()) {
      this._initState = InitState.Initialized;
      this._initResolve?.(this);
      this._onReady();
    }
  }

  /**
   * Apply a timeout promise to a base promise. This is for use with waitForInitialization.
   * Currently it returns a LDClient. In the future it should return a status.
   *
   * The client isn't always the expected type of the consumer. It returns an LDClient interface
   * which is less capable than, for example, the node client interface.
   *
   * @param basePromise The promise to race against a timeout.
   * @param timeout The timeout in seconds.
   * @param logger A logger to log when the timeout expires.
   * @returns
   */
  private _clientWithTimeout(
    basePromise: Promise<LDClient>,
    timeout?: number,
    logger?: LDLogger,
  ): Promise<LDClient> {
    if (timeout) {
      const cancelableTimeout = cancelableTimedPromise(timeout, 'waitForInitialization');
      return Promise.race([
        basePromise.then(() => this),
        cancelableTimeout.promise.then(() => this),
      ])
        .catch((reason) => {
          if (reason instanceof LDTimeoutError) {
            logger?.error(reason.message);
          }
          throw reason;
        })
        .finally(() => cancelableTimeout.cancel());
    }
    return basePromise;
  }
}
