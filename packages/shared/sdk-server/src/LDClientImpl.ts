/* eslint-disable class-methods-use-this */
import {
  ClientContext,
  Context,
  internal,
  LDClientError,
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDLogger,
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
} from './api';
import { Hook } from './api/integrations/Hook';
import { BigSegmentStoreMembership } from './api/interfaces';
import BigSegmentsManager from './BigSegmentsManager';
import BigSegmentStoreStatusProvider from './BigSegmentStatusProviderImpl';
import { createStreamListeners } from './data_sources/createStreamListeners';
import DataSourceUpdates from './data_sources/DataSourceUpdates';
import PollingProcessor from './data_sources/PollingProcessor';
import Requestor from './data_sources/Requestor';
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
import Configuration from './options/Configuration';
import VersionedDataKinds from './store/VersionedDataKinds';

const { ClientMessages, ErrorKinds, NullEventProcessor } = internal;
enum InitState {
  Initializing,
  Initialized,
  Failed,
}

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

/**
 * @ignore
 */
export default class LDClientImpl implements LDClient {
  private initState: InitState = InitState.Initializing;

  private featureStore: LDFeatureStore;

  private updateProcessor?: subsystem.LDStreamProcessor;

  private eventFactoryDefault = new EventFactory(false);

  private eventFactoryWithReasons = new EventFactory(true);

  private eventProcessor: subsystem.LDEventProcessor;

  private evaluator: Evaluator;

  private initResolve?: (value: LDClient | PromiseLike<LDClient>) => void;

  private initReject?: (err: Error) => void;

  private rejectionReason: Error | undefined;

  private initializedPromise?: Promise<LDClient>;

  private logger?: LDLogger;

  private config: Configuration;

  private bigSegmentsManager: BigSegmentsManager;

  private onError: (err: Error) => void;

  private onFailed: (err: Error) => void;

  private onReady: () => void;

  private diagnosticsManager?: internal.DiagnosticsManager;

  private hookRunner: HookRunner;

  /**
   * Intended for use by platform specific client implementations.
   *
   * It is not included in the main interface because it requires the use of
   * a platform event system. For node this would be an EventEmitter, for other
   * platforms it would likely be an EventTarget.
   */
  protected bigSegmentStatusProviderInternal: BigSegmentStoreStatusProvider;

  constructor(
    private sdkKey: string,
    private platform: Platform,
    options: LDOptions,
    callbacks: LDClientCallbacks,
    internalOptions?: internal.LDInternalOptions,
  ) {
    this.onError = callbacks.onError;
    this.onFailed = callbacks.onFailed;
    this.onReady = callbacks.onReady;

    const { onUpdate, hasEventListeners } = callbacks;
    const config = new Configuration(options, internalOptions);

    this.hookRunner = new HookRunner(config.logger, config.hooks || []);

    if (!sdkKey && !config.offline) {
      throw new Error('You must configure the client with an SDK key');
    }
    this.config = config;
    this.logger = config.logger;

    const clientContext = new ClientContext(sdkKey, config, platform);
    const featureStore = config.featureStoreFactory(clientContext);

    const dataSourceUpdates = new DataSourceUpdates(featureStore, hasEventListeners, onUpdate);

    if (config.sendEvents && !config.offline && !config.diagnosticOptOut) {
      this.diagnosticsManager = new internal.DiagnosticsManager(
        sdkKey,
        platform,
        createDiagnosticsInitConfig(config, platform, featureStore),
      );
    }

    if (!config.sendEvents || config.offline) {
      this.eventProcessor = new NullEventProcessor();
    } else {
      this.eventProcessor = new internal.EventProcessor(
        config,
        clientContext,
        new ContextDeduplicator(config),
        this.diagnosticsManager,
      );
    }

    this.featureStore = featureStore;

    const manager = new BigSegmentsManager(
      config.bigSegments?.store?.(clientContext),
      config.bigSegments ?? {},
      config.logger,
      this.platform.crypto,
    );
    this.bigSegmentsManager = manager;
    this.bigSegmentStatusProviderInternal = manager.statusProvider as BigSegmentStoreStatusProvider;

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
        return manager.getUserMembership(userKey);
      },
    };
    this.evaluator = new Evaluator(this.platform, queries);

    const listeners = createStreamListeners(dataSourceUpdates, this.logger, {
      put: () => this.initSuccess(),
    });
    const makeDefaultProcessor = () =>
      config.stream
        ? new internal.StreamingProcessor(
            sdkKey,
            clientContext,
            '/all',
            listeners,
            this.diagnosticsManager,
            (e) => this.dataSourceErrorHandler(e),
            this.config.streamInitialReconnectDelay,
          )
        : new PollingProcessor(
            config,
            new Requestor(sdkKey, config, this.platform.info, this.platform.requests),
            dataSourceUpdates,
            () => this.initSuccess(),
            (e) => this.dataSourceErrorHandler(e),
          );

    if (!(config.offline || config.useLdd)) {
      this.updateProcessor =
        config.updateProcessorFactory?.(
          clientContext,
          dataSourceUpdates,
          () => this.initSuccess(),
          (e) => this.dataSourceErrorHandler(e),
        ) ?? makeDefaultProcessor();
    }

    if (this.updateProcessor) {
      this.updateProcessor.start();
    } else {
      // Deferring the start callback should allow client construction to complete before we start
      // emitting events. Allowing the client an opportunity to register events.
      setTimeout(() => this.initSuccess(), 0);
    }
  }

  initialized(): boolean {
    return this.initState === InitState.Initialized;
  }

  waitForInitialization(): Promise<LDClient> {
    // An initialization promise is only created if someone is going to use that promise.
    // If we always created an initialization promise, and there was no call waitForInitialization
    // by the time the promise was rejected, then that would result in an unhandled promise
    // rejection.

    // Initialization promise was created by a previous call to waitForInitialization.
    if (this.initializedPromise) {
      return this.initializedPromise;
    }

    // Initialization completed before waitForInitialization was called, so we have completed
    // and there was no promise. So we make a resolved promise and return it.
    if (this.initState === InitState.Initialized) {
      this.initializedPromise = Promise.resolve(this);
      return this.initializedPromise;
    }

    // Initialization failed before waitForInitialization was called, so we have completed
    // and there was no promise. So we make a rejected promise and return it.
    if (this.initState === InitState.Failed) {
      this.initializedPromise = Promise.reject(this.rejectionReason);
      return this.initializedPromise;
    }

    if (!this.initializedPromise) {
      this.initializedPromise = new Promise((resolve, reject) => {
        this.initResolve = resolve;
        this.initReject = reject;
      });
    }
    return this.initializedPromise;
  }

  variation(
    key: string,
    context: LDContext,
    defaultValue: any,
    callback?: (err: any, res: any) => void,
  ): Promise<any> {
    return this.hookRunner
      .withEvaluationSeries(
        key,
        context,
        defaultValue,
        VARIATION_METHOD_NAME,
        () =>
          new Promise<LDEvaluationDetail>((resolve) => {
            this.evaluateIfPossible(key, context, defaultValue, this.eventFactoryDefault, (res) => {
              resolve(res.detail);
            });
          }),
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
    return this.hookRunner.withEvaluationSeries(
      key,
      context,
      defaultValue,
      VARIATION_METHOD_DETAIL_NAME,
      () =>
        new Promise<LDEvaluationDetail>((resolve) => {
          this.evaluateIfPossible(
            key,
            context,
            defaultValue,
            this.eventFactoryWithReasons,
            (res) => {
              resolve(res.detail);
              callback?.(null, res.detail);
            },
          );
        }),
    );
  }

  private typedEval<TResult>(
    key: string,
    context: LDContext,
    defaultValue: TResult,
    eventFactory: EventFactory,
    methodName: string,
    typeChecker: (value: unknown) => [boolean, string],
  ): Promise<LDEvaluationDetail> {
    return this.hookRunner.withEvaluationSeries(
      key,
      context,
      defaultValue,
      methodName,
      () =>
        new Promise<LDEvaluationDetailTyped<TResult>>((resolve) => {
          this.evaluateIfPossible(
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
    );
  }

  async boolVariation(key: string, context: LDContext, defaultValue: boolean): Promise<boolean> {
    return (
      await this.typedEval(
        key,
        context,
        defaultValue,
        this.eventFactoryDefault,
        BOOL_VARIATION_METHOD_NAME,
        (value) => [TypeValidators.Boolean.is(value), TypeValidators.Boolean.getType()],
      )
    ).value;
  }

  async numberVariation(key: string, context: LDContext, defaultValue: number): Promise<number> {
    return (
      await this.typedEval(
        key,
        context,
        defaultValue,
        this.eventFactoryDefault,
        NUMBER_VARIATION_METHOD_NAME,
        (value) => [TypeValidators.Number.is(value), TypeValidators.Number.getType()],
      )
    ).value;
  }

  async stringVariation(key: string, context: LDContext, defaultValue: string): Promise<string> {
    return (
      await this.typedEval(
        key,
        context,
        defaultValue,
        this.eventFactoryDefault,
        STRING_VARIATION_METHOD_NAME,
        (value) => [TypeValidators.String.is(value), TypeValidators.String.getType()],
      )
    ).value;
  }

  jsonVariation(key: string, context: LDContext, defaultValue: unknown): Promise<unknown> {
    return this.hookRunner
      .withEvaluationSeries(
        key,
        context,
        defaultValue,
        JSON_VARIATION_METHOD_NAME,
        () =>
          new Promise<LDEvaluationDetail>((resolve) => {
            this.evaluateIfPossible(key, context, defaultValue, this.eventFactoryDefault, (res) => {
              resolve(res.detail);
            });
          }),
      )
      .then((detail) => detail.value);
  }

  boolVariationDetail(
    key: string,
    context: LDContext,
    defaultValue: boolean,
  ): Promise<LDEvaluationDetailTyped<boolean>> {
    return this.typedEval(
      key,
      context,
      defaultValue,
      this.eventFactoryWithReasons,
      BOOL_VARIATION_DETAIL_METHOD_NAME,
      (value) => [TypeValidators.Boolean.is(value), TypeValidators.Boolean.getType()],
    );
  }

  numberVariationDetail(
    key: string,
    context: LDContext,
    defaultValue: number,
  ): Promise<LDEvaluationDetailTyped<number>> {
    return this.typedEval(
      key,
      context,
      defaultValue,
      this.eventFactoryWithReasons,
      NUMBER_VARIATION_DETAIL_METHOD_NAME,
      (value) => [TypeValidators.Number.is(value), TypeValidators.Number.getType()],
    );
  }

  stringVariationDetail(
    key: string,
    context: LDContext,
    defaultValue: string,
  ): Promise<LDEvaluationDetailTyped<string>> {
    return this.typedEval(
      key,
      context,
      defaultValue,
      this.eventFactoryWithReasons,
      STRING_VARIATION_DETAIL_METHOD_NAME,
      (value) => [TypeValidators.String.is(value), TypeValidators.String.getType()],
    );
  }

  jsonVariationDetail(
    key: string,
    context: LDContext,
    defaultValue: unknown,
  ): Promise<LDEvaluationDetailTyped<unknown>> {
    return this.hookRunner.withEvaluationSeries(
      key,
      context,
      defaultValue,
      JSON_VARIATION_DETAIL_METHOD_NAME,
      () =>
        new Promise<LDEvaluationDetail>((resolve) => {
          this.evaluateIfPossible(
            key,
            context,
            defaultValue,
            this.eventFactoryWithReasons,
            (res) => {
              resolve(res.detail);
            },
          );
        }),
    );
  }

  private async migrationVariationInternal(
    key: string,
    context: LDContext,
    defaultValue: LDMigrationStage,
  ): Promise<{ detail: LDEvaluationDetail; migration: LDMigrationVariation }> {
    const convertedContext = Context.fromLDContext(context);
    const res = await new Promise<{ detail: LDEvaluationDetail; flag?: Flag }>((resolve) => {
      this.evaluateIfPossible(
        key,
        context,
        defaultValue,
        this.eventFactoryWithReasons,
        ({ detail }, flag) => {
          if (!IsMigrationStage(detail.value)) {
            const error = new Error(
              `Unrecognized MigrationState for "${key}"; returning default value.`,
            );
            this.onError(error);
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
    const contextKeys = convertedContext.valid ? convertedContext.kindsAndKeys : {};
    const checkRatio = flag?.migration?.checkRatio;
    const samplingRatio = flag?.samplingRatio;

    return {
      detail,
      migration: {
        value: detail.value as LDMigrationStage,
        tracker: new MigrationOpTracker(
          key,
          contextKeys,
          defaultValue,
          detail.value,
          detail.reason,
          checkRatio,
          // Can be null for compatibility reasons.
          detail.variationIndex === null ? undefined : detail.variationIndex,
          flag?.version,
          samplingRatio,
          this.logger,
        ),
      },
    };
  }

  async migrationVariation(
    key: string,
    context: LDContext,
    defaultValue: LDMigrationStage,
  ): Promise<LDMigrationVariation> {
    const res = await this.hookRunner.withEvaluationSeriesExtraDetail(
      key,
      context,
      defaultValue,
      MIGRATION_VARIATION_METHOD_NAME,
      () => this.migrationVariationInternal(key, context, defaultValue),
    );

    return res.migration;
  }

  allFlagsState(
    context: LDContext,
    options?: LDFlagsStateOptions,
    callback?: (err: Error | null, res: LDFlagsState) => void,
  ): Promise<LDFlagsState> {
    if (this.config.offline) {
      this.logger?.info('allFlagsState() called in offline mode. Returning empty state.');
      const allFlagState = new FlagsStateBuilder(false, false).build();
      callback?.(null, allFlagState);
      return Promise.resolve(allFlagState);
    }

    const evalContext = Context.fromLDContext(context);
    if (!evalContext.valid) {
      this.logger?.info(`${evalContext.message ?? 'Invalid context.'}. Returning empty state.`);
      return Promise.resolve(new FlagsStateBuilder(false, false).build());
    }

    return new Promise<LDFlagsState>((resolve) => {
      const doEval = (valid: boolean) =>
        this.featureStore.all(VersionedDataKinds.Features, (allFlags) => {
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
              this.evaluator.evaluateCb(flag, evalContext, (res) => {
                if (res.isError) {
                  this.onError(
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
        this.featureStore.initialized((storeInitialized) => {
          let valid = true;
          if (storeInitialized) {
            this.logger?.warn(
              'Called allFlagsState before client initialization; using last known' +
                ' values from data store',
            );
          } else {
            this.logger?.warn(
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
    const hmac = this.platform.crypto.createHmac('sha256', this.sdkKey);
    if (key === undefined) {
      throw new LDClientError('Could not generate secure mode hash for invalid context');
    }
    hmac.update(key);
    return hmac.digest('hex');
  }

  close(): void {
    this.eventProcessor.close();
    this.updateProcessor?.close();
    this.featureStore.close();
    this.bigSegmentsManager.close();
  }

  isOffline(): boolean {
    return this.config.offline;
  }

  track(key: string, context: LDContext, data?: any, metricValue?: number): void {
    const checkedContext = Context.fromLDContext(context);
    if (!checkedContext.valid) {
      this.logger?.warn(ClientMessages.missingContextKeyNoEvent);
      return;
    }

    this.eventProcessor.sendEvent(
      this.eventFactoryDefault.customEvent(key, checkedContext!, data, metricValue),
    );
  }

  trackMigration(event: LDMigrationOpEvent): void {
    const converted = MigrationOpEventToInputEvent(event);
    if (!converted) {
      return;
    }

    this.eventProcessor.sendEvent(converted);
  }

  identify(context: LDContext): void {
    const checkedContext = Context.fromLDContext(context);
    if (!checkedContext.valid) {
      this.logger?.warn(ClientMessages.missingContextKeyNoEvent);
      return;
    }
    this.eventProcessor.sendEvent(this.eventFactoryDefault.identifyEvent(checkedContext!));
  }

  async flush(callback?: (err: Error | null, res: boolean) => void): Promise<void> {
    try {
      await this.eventProcessor.flush();
    } catch (err) {
      callback?.(err as Error, false);
    }
    callback?.(null, true);
  }

  addHook(hook: Hook): void {
    this.hookRunner.addHook(hook);
  }

  private variationInternal(
    flagKey: string,
    context: LDContext,
    defaultValue: any,
    eventFactory: EventFactory,
    cb: (res: EvalResult, flag?: Flag) => void,
    typeChecker?: (value: any) => [boolean, string],
  ): void {
    if (this.config.offline) {
      this.logger?.info('Variation called in offline mode. Returning default value.');
      cb(EvalResult.forError(ErrorKinds.ClientNotReady, undefined, defaultValue));
      return;
    }
    const evalContext = Context.fromLDContext(context);
    if (!evalContext.valid) {
      this.onError(
        new LDClientError(
          `${evalContext.message ?? 'Context not valid;'} returning default value.`,
        ),
      );
      cb(EvalResult.forError(ErrorKinds.UserNotSpecified, undefined, defaultValue));
      return;
    }

    this.featureStore.get(VersionedDataKinds.Features, flagKey, (item) => {
      const flag = item as Flag;
      if (!flag) {
        const error = new LDClientError(
          `Unknown feature flag "${flagKey}"; returning default value`,
        );
        this.onError(error);
        const result = EvalResult.forError(ErrorKinds.FlagNotFound, undefined, defaultValue);
        this.eventProcessor.sendEvent(
          this.eventFactoryDefault.unknownFlagEvent(flagKey, defaultValue, evalContext),
        );
        cb(result);
        return;
      }
      this.evaluator.evaluateCb(
        flag,
        evalContext,
        (evalRes) => {
          if (
            evalRes.detail.variationIndex === undefined ||
            evalRes.detail.variationIndex === null
          ) {
            this.logger?.debug('Result value is null in variation');
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
              this.sendEvalEvent(errorRes, eventFactory, flag, evalContext, defaultValue);
              cb(errorRes, flag);
              return;
            }
          }

          this.sendEvalEvent(evalRes, eventFactory, flag, evalContext, defaultValue);
          cb(evalRes, flag);
        },
        eventFactory,
      );
    });
  }

  private sendEvalEvent(
    evalRes: EvalResult,
    eventFactory: EventFactory,
    flag: Flag,
    evalContext: Context,
    defaultValue: any,
  ) {
    evalRes.events?.forEach((event) => {
      this.eventProcessor.sendEvent({ ...event });
    });
    this.eventProcessor.sendEvent(
      eventFactory.evalEventServer(flag, evalContext, evalRes.detail, defaultValue, undefined),
    );
  }

  private evaluateIfPossible(
    flagKey: string,
    context: LDContext,
    defaultValue: any,
    eventFactory: EventFactory,
    cb: (res: EvalResult, flag?: Flag) => void,
    typeChecker?: (value: any) => [boolean, string],
  ): void {
    if (!this.initialized()) {
      this.featureStore.initialized((storeInitialized) => {
        if (storeInitialized) {
          this.logger?.warn(
            'Variation called before LaunchDarkly client initialization completed' +
              " (did you wait for the 'ready' event?) - using last known values from feature store",
          );
          this.variationInternal(flagKey, context, defaultValue, eventFactory, cb, typeChecker);
          return;
        }
        this.logger?.warn(
          'Variation called before LaunchDarkly client initialization completed (did you wait for the' +
            "'ready' event?) - using default value",
        );
        cb(EvalResult.forError(ErrorKinds.ClientNotReady, undefined, defaultValue));
      });
      return;
    }
    this.variationInternal(flagKey, context, defaultValue, eventFactory, cb, typeChecker);
  }

  private dataSourceErrorHandler(e: any) {
    const error =
      e.code === 401 ? new Error('Authentication failed. Double check your SDK key.') : e;

    this.onError(error);
    this.onFailed(error);

    if (!this.initialized()) {
      this.initState = InitState.Failed;
      this.rejectionReason = error;
      this.initReject?.(error);
    }
  }

  private initSuccess() {
    if (!this.initialized()) {
      this.initState = InitState.Initialized;
      this.initResolve?.(this);
      this.onReady();
    }
  }
}
