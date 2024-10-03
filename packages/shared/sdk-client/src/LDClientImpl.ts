import {
  AutoEnvAttributes,
  clone,
  Context,
  defaultHeaders,
  Encoding,
  internal,
  LDClientError,
  LDContext,
  LDFlagSet,
  LDFlagValue,
  LDHeaders,
  LDLogger,
  Platform,
  ProcessStreamResponse,
  EventName as StreamEventName,
  timedPromise,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';
import { LDStreamProcessor } from '@launchdarkly/js-sdk-common/dist/api/subsystem';

import { ConnectionMode, LDClient, type LDOptions } from './api';
import { LDEvaluationDetail, LDEvaluationDetailTyped } from './api/LDEvaluationDetail';
import { LDIdentifyOptions } from './api/LDIdentifyOptions';
import Configuration from './configuration';
import { LDClientInternalOptions } from './configuration/Configuration';
import { addAutoEnv } from './context/addAutoEnv';
import { ensureKey } from './context/ensureKey';
import createDiagnosticsManager from './diagnostics/createDiagnosticsManager';
import {
  createErrorEvaluationDetail,
  createSuccessEvaluationDetail,
} from './evaluation/evaluationDetail';
import createEventProcessor from './events/createEventProcessor';
import EventFactory from './events/EventFactory';
import FlagManager from './flag-manager/FlagManager';
import { ItemDescriptor } from './flag-manager/ItemDescriptor';
import LDEmitter, { EventName } from './LDEmitter';
import PollingProcessor from './polling/PollingProcessor';
import { StreamingProcessor } from './streaming';
import { DataSourcePaths } from './streaming/DataSourceConfig';
import { DeleteFlag, Flags, PatchFlag } from './types';

const { ClientMessages, ErrorKinds } = internal;

export default class LDClientImpl implements LDClient {
  private readonly config: Configuration;
  private uncheckedContext?: LDContext;
  private checkedContext?: Context;
  private readonly diagnosticsManager?: internal.DiagnosticsManager;
  private eventProcessor?: internal.EventProcessor;
  private identifyTimeout: number = 5;
  readonly logger: LDLogger;
  private updateProcessor?: LDStreamProcessor;

  private readonly highTimeoutThreshold: number = 15;

  private eventFactoryDefault = new EventFactory(false);
  private eventFactoryWithReasons = new EventFactory(true);
  private emitter: LDEmitter;
  private flagManager: FlagManager;

  private eventSendingEnabled: boolean = true;
  private networkAvailable: boolean = true;
  private connectionMode: ConnectionMode;
  private baseHeaders: LDHeaders;

  /**
   * Creates the client object synchronously. No async, no network calls.
   */
  constructor(
    public readonly sdkKey: string,
    public readonly autoEnvAttributes: AutoEnvAttributes,
    public readonly platform: Platform,
    options: LDOptions,
    internalOptions?: LDClientInternalOptions,
  ) {
    if (!sdkKey) {
      throw new Error('You must configure the client with a client-side SDK key');
    }

    if (!platform.encoding) {
      throw new Error('Platform must implement Encoding because btoa is required.');
    }

    this.config = new Configuration(options, internalOptions);
    this.connectionMode = this.config.initialConnectionMode;
    this.logger = this.config.logger;

    this.baseHeaders = defaultHeaders(
      this.sdkKey,
      this.platform.info,
      this.config.tags,
      this.config.serviceEndpoints.includeAuthorizationHeader,
      this.config.userAgentHeaderName,
    );

    this.flagManager = new FlagManager(
      this.platform,
      sdkKey,
      this.config.maxCachedContexts,
      this.config.logger,
    );
    this.diagnosticsManager = createDiagnosticsManager(sdkKey, this.config, platform);
    this.eventProcessor = createEventProcessor(
      sdkKey,
      this.config,
      platform,
      this.baseHeaders,
      this.diagnosticsManager,
      !this.isOffline(),
    );
    this.emitter = new LDEmitter();
    this.emitter.on('change', (c: LDContext, changedKeys: string[]) => {
      this.logger.debug(`change: context: ${JSON.stringify(c)}, flags: ${changedKeys}`);
    });
    this.emitter.on('error', (c: LDContext, err: any) => {
      this.logger.error(`error: ${err}, context: ${JSON.stringify(c)}`);
    });

    this.flagManager.on((context, flagKeys) => {
      const ldContext = Context.toLDContext(context);
      this.emitter.emit('change', ldContext, flagKeys);
    });
  }

  /**
   * Sets the SDK connection mode.
   *
   * @param mode - One of supported {@link ConnectionMode}. Default is 'streaming'.
   */
  async setConnectionMode(mode: ConnectionMode): Promise<void> {
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
        if (this.uncheckedContext) {
          // identify will start the update processor
          return this.identify(this.uncheckedContext, { timeout: this.identifyTimeout });
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

  /**
   * Gets the SDK connection mode.
   */
  getConnectionMode(): ConnectionMode {
    return this.connectionMode;
  }

  isOffline() {
    return this.connectionMode === 'offline';
  }

  allFlags(): LDFlagSet {
    // extracting all flag values
    const result = Object.entries(this.flagManager.getAll()).reduce(
      (acc: LDFlagSet, [key, descriptor]) => {
        if (descriptor.flag !== null && descriptor.flag !== undefined && !descriptor.flag.deleted) {
          acc[key] = descriptor.flag.value;
        }
        return acc;
      },
      {},
    );
    return result;
  }

  async close(): Promise<void> {
    await this.flush();
    this.eventProcessor?.close();
    this.updateProcessor?.close();
    this.logger.debug('Closed event processor and data source.');
  }

  async flush(): Promise<{ error?: Error; result: boolean }> {
    try {
      await this.eventProcessor?.flush();
      this.logger.debug('Successfully flushed event processor.');
    } catch (e) {
      this.logger.error(`Error flushing event processor: ${e}.`);
      return { error: e as Error, result: false };
    }

    return { result: true };
  }

  getContext(): LDContext | undefined {
    // The LDContext returned here may have been modified by the SDK (for example: adding auto env attributes).
    // We are returning an LDContext here to maintain a consistent represetnation of context to the consuming
    // code.  We are returned the unchecked context so that if a consumer identifies with an invalid context
    // and then calls getContext, they get back the same context they provided, without any assertion about
    // validity.
    return this.uncheckedContext ? clone<LDContext>(this.uncheckedContext) : undefined;
  }

  protected getInternalContext(): Context | undefined {
    return this.checkedContext;
  }

  private createStreamListeners(
    context: Context,
    identifyResolve: any,
  ): Map<StreamEventName, ProcessStreamResponse> {
    const listeners = new Map<StreamEventName, ProcessStreamResponse>();

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
        await this.flagManager.init(context, descriptors).then(identifyResolve());
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

  protected getStreamingPaths(): DataSourcePaths {
    return {
      pathGet(_encoding: Encoding, _plainContextString: string): string {
        throw new Error(
          'getStreamingPaths not implemented. Client sdks must implement getStreamingPaths for streaming with GET to work.',
        );
      },
      pathReport(_encoding: Encoding, _plainContextString: string): string {
        throw new Error(
          'getStreamingPaths not implemented. Client sdks must implement getStreamingPaths for streaming with REPORT to work.',
        );
      },
    };
  }

  protected getPollingPaths(): DataSourcePaths {
    return {
      pathGet(_encoding: Encoding, _plainContextString: string): string {
        throw new Error(
          'getPollingPaths not implemented. Client sdks must implement getPollingPaths for polling with GET to work.',
        );
      },
      pathReport(_encoding: Encoding, _plainContextString: string): string {
        throw new Error(
          'getPollingPaths not implemented. Client sdks must implement getPollingPaths for polling with REPORT to work.',
        );
      },
    };
  }

  private createIdentifyPromise(timeout: number) {
    let res: any;
    let rej: any;

    const slow = new Promise<void>((resolve, reject) => {
      res = resolve;
      rej = reject;
    });

    const timed = timedPromise(timeout, 'identify');
    const raced = Promise.race([timed, slow]).catch((e) => {
      if (e.message.includes('timed out')) {
        this.logger.error(`identify error: ${e}`);
      }
      throw e;
    });

    return { identifyPromise: raced, identifyResolve: res, identifyReject: rej };
  }

  /**
   * Identifies a context to LaunchDarkly. See {@link LDClient.identify}.
   *
   * @param pristineContext The LDContext object to be identified.
   * @param identifyOptions Optional configuration. See {@link LDIdentifyOptions}.
   * @returns A Promise which resolves when the flag values for the specified
   * context are available. It rejects when:
   *
   * 1. The context is unspecified or has no key.
   *
   * 2. The identify timeout is exceeded. In client SDKs this defaults to 5s.
   * You can customize this timeout with {@link LDIdentifyOptions | identifyOptions}.
   *
   * 3. A network error is encountered during initialization.
   */
  async identify(pristineContext: LDContext, identifyOptions?: LDIdentifyOptions): Promise<void> {
    // In offline mode we do not support waiting for results.
    const waitForNetworkResults = !!identifyOptions?.waitForNetworkResults && !this.isOffline();

    if (identifyOptions?.timeout) {
      this.identifyTimeout = identifyOptions.timeout;
    }

    if (this.identifyTimeout > this.highTimeoutThreshold) {
      this.logger.warn(
        'The identify function was called with a timeout greater than ' +
          `${this.highTimeoutThreshold} seconds. We recommend a timeout of less than ` +
          `${this.highTimeoutThreshold} seconds.`,
      );
    }

    let context = await ensureKey(pristineContext, this.platform);

    if (this.autoEnvAttributes === AutoEnvAttributes.Enabled) {
      context = await addAutoEnv(context, this.platform, this.config);
    }

    const checkedContext = Context.fromLDContext(context);
    if (!checkedContext.valid) {
      const error = new Error('Context was unspecified or had no key');
      this.emitter.emit('error', context, error);
      return Promise.reject(error);
    }
    this.uncheckedContext = context;
    this.checkedContext = checkedContext;

    this.eventProcessor?.sendEvent(this.eventFactoryDefault.identifyEvent(this.checkedContext));
    const { identifyPromise, identifyResolve, identifyReject } = this.createIdentifyPromise(
      this.identifyTimeout,
    );
    this.logger.debug(`Identifying ${JSON.stringify(this.checkedContext)}`);

    const loadedFromCache = await this.flagManager.loadCached(this.checkedContext);
    if (loadedFromCache && !waitForNetworkResults) {
      this.logger.debug('Identify completing with cached flags');
      identifyResolve();
    }
    if (loadedFromCache && waitForNetworkResults) {
      this.logger.debug(
        'Identify - Flags loaded from cache, but identify was requested with "waitForNetworkResults"',
      );
    }

    if (this.isOffline()) {
      if (loadedFromCache) {
        this.logger.debug('Offline identify - using cached flags.');
      } else {
        this.logger.debug(
          'Offline identify - no cached flags, using defaults or already loaded flags.',
        );
        identifyResolve();
      }
    } else {
      this.updateProcessor?.close();
      switch (this.getConnectionMode()) {
        case 'streaming':
          this.createStreamingProcessor(context, checkedContext, identifyResolve, identifyReject);
          break;
        case 'polling':
          this.createPollingProcessor(context, checkedContext, identifyResolve, identifyReject);
          break;
        default:
          break;
      }
      this.updateProcessor!.start();
    }

    return identifyPromise;
  }

  private createPollingProcessor(
    context: LDContext,
    checkedContext: Context,
    identifyResolve: any,
    identifyReject: any,
  ) {
    this.updateProcessor = new PollingProcessor(
      JSON.stringify(context),
      {
        credential: this.sdkKey,
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

        await this.flagManager.init(checkedContext, descriptors).then(identifyResolve());
      },
      (err) => {
        identifyReject(err);
        this.emitter.emit('error', context, err);
      },
    );
  }

  private createStreamingProcessor(
    context: LDContext,
    checkedContext: Context,
    identifyResolve: any,
    identifyReject: any,
  ) {
    this.updateProcessor = new StreamingProcessor(
      JSON.stringify(context),
      {
        credential: this.sdkKey,
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
        identifyReject(e);
        this.emitter.emit('error', context, e);
      },
    );
  }

  off(eventName: EventName, listener: Function): void {
    this.emitter.off(eventName, listener);
  }

  on(eventName: EventName, listener: Function): void {
    this.emitter.on(eventName, listener);
  }

  track(key: string, data?: any, metricValue?: number): void {
    if (!this.checkedContext || !this.checkedContext.valid) {
      this.logger.warn(ClientMessages.missingContextKeyNoEvent);
      return;
    }

    // 0 is valid, so do not truthy check the metric value
    if (metricValue !== undefined && !TypeValidators.Number.is(metricValue)) {
      this.logger?.warn(ClientMessages.invalidMetricValue(typeof metricValue));
    }

    this.eventProcessor?.sendEvent(
      this.config.trackEventModifier(
        this.eventFactoryDefault.customEvent(key, this.checkedContext!, data, metricValue),
      ),
    );
  }

  private variationInternal(
    flagKey: string,
    defaultValue: any,
    eventFactory: EventFactory,
    typeChecker?: (value: any) => [boolean, string],
  ): LDEvaluationDetail {
    if (!this.uncheckedContext) {
      this.logger.debug(ClientMessages.missingContextKeyNoEvent);
      return createErrorEvaluationDetail(ErrorKinds.UserNotSpecified, defaultValue);
    }

    const evalContext = Context.fromLDContext(this.uncheckedContext);
    const foundItem = this.flagManager.get(flagKey);

    if (foundItem === undefined || foundItem.flag.deleted) {
      const defVal = defaultValue ?? null;
      const error = new LDClientError(
        `Unknown feature flag "${flagKey}"; returning default value ${defVal}.`,
      );
      this.emitter.emit('error', this.uncheckedContext, error);
      this.eventProcessor?.sendEvent(
        this.eventFactoryDefault.unknownFlagEvent(flagKey, defVal, evalContext),
      );
      return createErrorEvaluationDetail(ErrorKinds.FlagNotFound, defaultValue);
    }

    const { reason, value, variation, prerequisites } = foundItem.flag;

    if (typeChecker) {
      const [matched, type] = typeChecker(value);
      if (!matched) {
        this.eventProcessor?.sendEvent(
          eventFactory.evalEventClient(
            flagKey,
            defaultValue, // track default value on type errors
            defaultValue,
            foundItem.flag,
            evalContext,
            reason,
          ),
        );
        const error = new LDClientError(
          `Wrong type "${type}" for feature flag "${flagKey}"; returning default value`,
        );
        this.emitter.emit('error', this.uncheckedContext, error);
        return createErrorEvaluationDetail(ErrorKinds.WrongType, defaultValue);
      }
    }

    const successDetail = createSuccessEvaluationDetail(value, variation, reason, prerequisites);
    if (value === undefined || value === null) {
      this.logger.debug('Result value is null. Providing default value.');
      successDetail.value = defaultValue;
    }

    successDetail.prerequisites?.forEach((prereqKey) => {
      this.variation(prereqKey, undefined);
    });
    this.eventProcessor?.sendEvent(
      eventFactory.evalEventClient(
        flagKey,
        value,
        defaultValue,
        foundItem.flag,
        evalContext,
        reason,
      ),
    );
    return successDetail;
  }

  variation(flagKey: string, defaultValue?: LDFlagValue): LDFlagValue {
    const { value } = this.variationInternal(flagKey, defaultValue, this.eventFactoryDefault);
    return value;
  }
  variationDetail(flagKey: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
    return this.variationInternal(flagKey, defaultValue, this.eventFactoryWithReasons);
  }

  private typedEval<T>(
    key: string,
    defaultValue: T,
    eventFactory: EventFactory,
    typeChecker: (value: unknown) => [boolean, string],
  ): LDEvaluationDetailTyped<T> {
    return this.variationInternal(key, defaultValue, eventFactory, typeChecker);
  }

  boolVariation(key: string, defaultValue: boolean): boolean {
    return this.typedEval(key, defaultValue, this.eventFactoryDefault, (value) => [
      TypeValidators.Boolean.is(value),
      TypeValidators.Boolean.getType(),
    ]).value;
  }

  jsonVariation(key: string, defaultValue: unknown): unknown {
    return this.variation(key, defaultValue);
  }

  numberVariation(key: string, defaultValue: number): number {
    return this.typedEval(key, defaultValue, this.eventFactoryDefault, (value) => [
      TypeValidators.Number.is(value),
      TypeValidators.Number.getType(),
    ]).value;
  }

  stringVariation(key: string, defaultValue: string): string {
    return this.typedEval(key, defaultValue, this.eventFactoryDefault, (value) => [
      TypeValidators.String.is(value),
      TypeValidators.String.getType(),
    ]).value;
  }

  boolVariationDetail(key: string, defaultValue: boolean): LDEvaluationDetailTyped<boolean> {
    return this.typedEval(key, defaultValue, this.eventFactoryWithReasons, (value) => [
      TypeValidators.Boolean.is(value),
      TypeValidators.Boolean.getType(),
    ]);
  }

  numberVariationDetail(key: string, defaultValue: number): LDEvaluationDetailTyped<number> {
    return this.typedEval(key, defaultValue, this.eventFactoryWithReasons, (value) => [
      TypeValidators.Number.is(value),
      TypeValidators.Number.getType(),
    ]);
  }

  stringVariationDetail(key: string, defaultValue: string): LDEvaluationDetailTyped<string> {
    return this.typedEval(key, defaultValue, this.eventFactoryWithReasons, (value) => [
      TypeValidators.String.is(value),
      TypeValidators.String.getType(),
    ]);
  }

  jsonVariationDetail(key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown> {
    return this.variationDetail(key, defaultValue);
  }

  /**
   * Inform the client of the network state. Can be used to modify connection behavior.
   *
   * For instance the implementation may choose to suppress errors from connections if the client
   * knows that there is no network available.
   * @param _available True when there is an available network.
   */
  protected setNetworkAvailability(available: boolean): void {
    this.networkAvailable = available;
    // Not yet supported.
  }

  /**
   * Enable/Disable event sending.
   * @param enabled True to enable event processing, false to disable.
   * @param flush True to flush while disabling. Useful to flush on certain state transitions.
   */
  protected setEventSendingEnabled(enabled: boolean, flush: boolean): void {
    if (this.eventSendingEnabled === enabled) {
      return;
    }
    this.eventSendingEnabled = enabled;

    if (enabled) {
      this.logger.debug('Starting event processor');
      this.eventProcessor?.start();
    } else if (flush) {
      this.logger?.debug('Flushing event processor before disabling.');
      // Disable and flush.
      this.flush().then(() => {
        // While waiting for the flush event sending could be re-enabled, in which case
        // we do not want to close the event processor.
        if (!this.eventSendingEnabled) {
          this.logger?.debug('Stopping event processor.');
          this.eventProcessor?.close();
        }
      });
    } else {
      // Just disabled.
      this.logger?.debug('Stopping event processor.');
      this.eventProcessor?.close();
    }
  }

  protected sendEvent(event: internal.InputEvent): void {
    this.eventProcessor?.sendEvent(event);
  }
}
