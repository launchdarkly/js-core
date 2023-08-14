/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable class-methods-use-this */
import {
  ClientContext,
  Context,
  internal,
  LDContext,
  LDEvaluationDetail,
  LDLogger,
  Platform,
  subsystem,
} from '@launchdarkly/js-sdk-common';

import {
  LDClient,
  LDFeatureStore,
  LDFlagsState,
  LDFlagsStateOptions,
  LDOptions,
  LDStreamProcessor,
} from './api';
import { BigSegmentStoreMembership } from './api/interfaces';
import BigSegmentsManager from './BigSegmentsManager';
import BigSegmentStoreStatusProvider from './BigSegmentStatusProviderImpl';
import ClientMessages from './ClientMessages';
import DataSourceUpdates from './data_sources/DataSourceUpdates';
import NullUpdateProcessor from './data_sources/NullUpdateProcessor';
import PollingProcessor from './data_sources/PollingProcessor';
import Requestor from './data_sources/Requestor';
import StreamingProcessor from './data_sources/StreamingProcessor';
import { LDClientError } from './errors';
import { allSeriesAsync } from './evaluation/collection';
import { Flag } from './evaluation/data/Flag';
import { Segment } from './evaluation/data/Segment';
import ErrorKinds from './evaluation/ErrorKinds';
import EvalResult from './evaluation/EvalResult';
import Evaluator from './evaluation/Evaluator';
import { Queries } from './evaluation/Queries';
import ContextDeduplicator from './events/ContextDeduplicator';
import DiagnosticsManager from './events/DiagnosticsManager';
import EventFactory from './events/EventFactory';
import EventSender from './events/EventSender';
import isExperiment from './events/isExperiment';
import NullEventProcessor from './events/NullEventProcessor';
import FlagsStateBuilder from './FlagsStateBuilder';
import Configuration from './options/Configuration';
import { AsyncStoreFacade } from './store';
import VersionedDataKinds from './store/VersionedDataKinds';

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

/**
 * @ignore
 */
export default class LDClientImpl implements LDClient {
  private initState: InitState = InitState.Initializing;

  private featureStore: LDFeatureStore;

  private asyncFeatureStore: AsyncStoreFacade;

  private updateProcessor: LDStreamProcessor;

  private eventFactoryDefault = new EventFactory(false);

  private eventFactoryWithReasons = new EventFactory(true);

  private eventProcessor: subsystem.LDEventProcessor;

  private evaluator: Evaluator;

  private initResolve?: (value: LDClient | PromiseLike<LDClient>) => void;

  private initReject?: (err: Error) => void;

  private initializedPromise?: Promise<LDClient>;

  private logger?: LDLogger;

  private config: Configuration;

  private bigSegmentsManager: BigSegmentsManager;

  private onError: (err: Error) => void;

  private onFailed: (err: Error) => void;

  private onReady: () => void;

  private diagnosticsManager?: DiagnosticsManager;

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
  ) {
    this.onError = callbacks.onError;
    this.onFailed = callbacks.onFailed;
    this.onReady = callbacks.onReady;

    const { onUpdate, hasEventListeners } = callbacks;
    const config = new Configuration(options);
    if (!sdkKey && !config.offline) {
      throw new Error('You must configure the client with an SDK key');
    }
    this.config = config;
    this.logger = config.logger;

    const clientContext = new ClientContext(sdkKey, config, platform);
    const featureStore = config.featureStoreFactory(clientContext);
    this.asyncFeatureStore = new AsyncStoreFacade(featureStore);
    const dataSourceUpdates = new DataSourceUpdates(featureStore, hasEventListeners, onUpdate);

    if (config.sendEvents && !config.offline && !config.diagnosticOptOut) {
      this.diagnosticsManager = new DiagnosticsManager(sdkKey, config, platform, featureStore);
    }

    const makeDefaultProcessor = () =>
      config.stream
        ? new StreamingProcessor(
            sdkKey,
            config,
            this.platform.requests,
            this.platform.info,
            dataSourceUpdates,
            this.diagnosticsManager,
          )
        : new PollingProcessor(
            config,
            new Requestor(sdkKey, config, this.platform.info, this.platform.requests),
            dataSourceUpdates,
          );

    if (config.offline || config.useLdd) {
      this.updateProcessor = new NullUpdateProcessor();
    } else {
      this.updateProcessor =
        config.updateProcessorFactory?.(clientContext, dataSourceUpdates) ?? makeDefaultProcessor();
    }

    if (!config.sendEvents || config.offline) {
      this.eventProcessor = new NullEventProcessor();
    } else {
      this.eventProcessor = new internal.EventProcessor(
        config,
        clientContext,
        new EventSender(config, clientContext),
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

    this.updateProcessor.start((err) => {
      if (err) {
        let error;
        if ((err.status && err.status === 401) || (err.code && err.code === 401)) {
          error = new Error('Authentication failed. Double check your SDK key.');
        } else {
          error = err;
        }

        this.onError(error);
        this.onFailed(error);
        this.initReject?.(error);
        this.initState = InitState.Failed;
      } else if (!this.initialized()) {
        this.initState = InitState.Initialized;
        this.initResolve?.(this);
        this.onReady();
      }
    });
  }

  initialized(): boolean {
    return this.initState === InitState.Initialized;
  }

  waitForInitialization(): Promise<LDClient> {
    if (this.initState === InitState.Initialized) {
      return Promise.resolve(this);
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
    return new Promise<any>((resolve) => {
      this.evaluateIfPossible(key, context, defaultValue, this.eventFactoryDefault, (res) => {
        resolve(res.detail.value);
        callback?.(null, res.detail.value);
      });
    });
  }

  variationDetail(
    key: string,
    context: LDContext,
    defaultValue: any,
    callback?: (err: any, res: LDEvaluationDetail) => void,
  ): Promise<LDEvaluationDetail> {
    return new Promise<LDEvaluationDetail>((resolve) => {
      this.evaluateIfPossible(key, context, defaultValue, this.eventFactoryWithReasons, (res) => {
        resolve(res.detail);
        callback?.(null, res.detail);
      });
    });
  }

  async allFlagsState(
    context: LDContext,
    options?: LDFlagsStateOptions,
    callback?: (err: Error | null, res: LDFlagsState) => void,
  ): Promise<LDFlagsState> {
    if (this.config.offline) {
      this.logger?.info('allFlagsState() called in offline mode. Returning empty state.');
      const allFlagState = new FlagsStateBuilder(false, false).build();
      callback?.(null, allFlagState);
      return allFlagState;
    }

    const evalContext = Context.fromLDContext(context);
    if (!evalContext.valid) {
      this.logger?.info(`${evalContext.message ?? 'Invalid context.'}. Returning empty state.`);
      return new FlagsStateBuilder(false, false).build();
    }

    let valid = true;
    if (!this.initialized()) {
      const storeInitialized = await this.asyncFeatureStore.initialized();

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
    }

    const builder = new FlagsStateBuilder(valid, !!options?.withReasons);
    const clientOnly = !!options?.clientSideOnly;
    const detailsOnlyIfTracked = !!options?.detailsOnlyForTrackedFlags;

    return new Promise<LDFlagsState>((resolve) => {
      this.featureStore.all(VersionedDataKinds.Features, (allFlags) => {
        allSeriesAsync(
          Object.values(allFlags),
          async (storeItem, _index, iterCb) => {
            const flag = storeItem as Flag;
            if (clientOnly && !flag.clientSide) {
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
    this.updateProcessor.close();
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

  private variationInternal(
    flagKey: string,
    context: LDContext,
    defaultValue: any,
    eventFactory: EventFactory,
    cb: (res: EvalResult) => void,
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
          this.eventFactoryDefault.unknownFlagEvent(flagKey, evalContext, result.detail),
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
          evalRes.events?.forEach((event) => {
            this.eventProcessor.sendEvent(event);
          });
          this.eventProcessor.sendEvent(
            eventFactory.evalEvent(flag, evalContext, evalRes.detail, defaultValue),
          );
          cb(evalRes);
        },
        eventFactory,
      );
    });
  }

  private evaluateIfPossible(
    flagKey: string,
    context: LDContext,
    defaultValue: any,
    eventFactory: EventFactory,
    cb: (res: EvalResult) => void,
  ): void {
    if (!this.initialized()) {
      this.featureStore.initialized((storeInitialized) => {
        if (storeInitialized) {
          this.logger?.warn(
            'Variation called before LaunchDarkly client initialization completed' +
              " (did you wait for the 'ready' event?) - using last known values from feature store",
          );
          this.variationInternal(flagKey, context, defaultValue, eventFactory, cb);
          return;
        }
        this.logger?.warn(
          'Variation called before LaunchDarkly client initialization completed (did you wait for the' +
            "'ready' event?) - using default value",
        );
        cb(EvalResult.forError(ErrorKinds.ClientNotReady, undefined, defaultValue));
      });
    }
    this.variationInternal(flagKey, context, defaultValue, eventFactory, cb);
  }
}
