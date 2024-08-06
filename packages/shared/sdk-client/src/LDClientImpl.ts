import {
  AutoEnvAttributes,
  ClientContext,
  clone,
  Context,
  internal,
  LDClientError,
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagSet,
  LDFlagValue,
  LDLogger,
  Platform,
  ProcessStreamResponse,
  EventName as StreamEventName,
  timedPromise,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';
import { LDStreamProcessor } from '@launchdarkly/js-sdk-common/dist/api/subsystem';

import { ConnectionMode, LDClient, type LDOptions } from './api';
import LDEmitter, { EventName } from './api/LDEmitter';
import { LDIdentifyOptions } from './api/LDIdentifyOptions';
import Configuration from './configuration';
import createDiagnosticsManager from './diagnostics/createDiagnosticsManager';
import createEventProcessor from './events/createEventProcessor';
import EventFactory from './events/EventFactory';
import FlagManager from './flag-manager/FlaggManager';
import { ItemDescriptor } from './flag-manager/ItemDescriptor';
import PollingProcessor from './polling/PollingProcessor';
import { DeleteFlag, Flags, PatchFlag } from './types';
import { addAutoEnv, ensureKey } from './utils';

const { createErrorEvaluationDetail, createSuccessEvaluationDetail, ClientMessages, ErrorKinds } =
  internal;

export default class LDClientImpl implements LDClient {
  private readonly config: Configuration;
  private inputContext?: LDContext;
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

  private readonly clientContext: ClientContext;

  private eventSendingEnabled: boolean = true;
  private networkAvailable: boolean = true;
  private connectionMode: ConnectionMode;

  /**
   * Creates the client object synchronously. No async, no network calls.
   */
  constructor(
    public readonly sdkKey: string,
    public readonly autoEnvAttributes: AutoEnvAttributes,
    public readonly platform: Platform,
    options: LDOptions,
    internalOptions?: internal.LDInternalOptions,
  ) {
    if (!sdkKey) {
      throw new Error('You must configure the client with a client-side SDK key');
    }

    if (!platform.encoding) {
      throw new Error('Platform must implement Encoding because btoa is required.');
    }

    this.config = new Configuration(options, internalOptions);
    this.connectionMode = this.config.initialConnectionMode;
    this.clientContext = new ClientContext(sdkKey, this.config, platform);
    this.logger = this.config.logger;
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
        if (this.inputContext) {
          // identify will start the update processor
          return this.identify(this.inputContext, { timeout: this.identifyTimeout });
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
    return this.inputContext ? clone<LDContext>(this.inputContext) : undefined;
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

  /**
   * Generates the url path for streaming.
   *
   * @protected This function must be overridden in subclasses for streaming
   * to work.
   * @param _context The LDContext object
   */
  protected createStreamUriPath(_context: LDContext): string {
    throw new Error(
      'createStreamUriPath not implemented. Client sdks must implement createStreamUriPath for streaming to work.',
    );
  }

  /**
   * Generates the url path for polling.
   * @param _context
   *
   * @protected This function must be overridden in subclasses for polling
   * to work.
   * @param _context The LDContext object
   */
  protected createPollUriPath(_context: LDContext): string {
    throw new Error(
      'createPollUriPath not implemented. Client sdks must implement createPollUriPath for polling to work.',
    );
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
    this.inputContext = context;
    this.checkedContext = checkedContext;

    this.eventProcessor?.sendEvent(this.eventFactoryDefault.identifyEvent(this.checkedContext));
    const { identifyPromise, identifyResolve, identifyReject } = this.createIdentifyPromise(
      this.identifyTimeout,
    );
    this.logger.debug(`Identifying ${JSON.stringify(this.checkedContext)}`);

    const loadedFromCache = await this.flagManager.loadCached(this.checkedContext);
    if (loadedFromCache) {
      identifyResolve();
    }

    if (this.isOffline()) {
      if (loadedFromCache) {
        this.logger.debug('Offline identify using storage flags.');
      } else {
        this.logger.debug('Offline identify no storage. Defaults will be used.');
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
    let pollingPath = this.createPollUriPath(context);
    if (this.config.withReasons) {
      pollingPath = `${pollingPath}?withReasons=true`;
    }
    this.updateProcessor = new PollingProcessor(
      this.sdkKey,
      this.clientContext.platform.requests,
      this.clientContext.platform.info,
      pollingPath,
      this.config,
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
    let streamingPath = this.createStreamUriPath(context);
    if (this.config.withReasons) {
      streamingPath = `${streamingPath}?withReasons=true`;
    }

    this.updateProcessor = new internal.StreamingProcessor(
      this.sdkKey,
      this.clientContext,
      streamingPath,
      this.createStreamListeners(checkedContext, identifyResolve),
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
      this.eventFactoryDefault.customEvent(key, this.checkedContext!, data, metricValue),
    );
  }

  private variationInternal(
    flagKey: string,
    defaultValue: any,
    eventFactory: EventFactory,
    typeChecker?: (value: any) => [boolean, string],
  ): LDFlagValue {
    if (!this.inputContext) {
      this.logger.debug(ClientMessages.missingContextKeyNoEvent);
      return createErrorEvaluationDetail(ErrorKinds.UserNotSpecified, defaultValue);
    }

    const evalContext = Context.fromLDContext(this.inputContext);
    const foundItem = this.flagManager.get(flagKey);

    if (foundItem === undefined || foundItem.flag.deleted) {
      const defVal = defaultValue ?? null;
      const error = new LDClientError(
        `Unknown feature flag "${flagKey}"; returning default value ${defVal}.`,
      );
      this.emitter.emit('error', this.inputContext, error);
      this.eventProcessor?.sendEvent(
        this.eventFactoryDefault.unknownFlagEvent(flagKey, defVal, evalContext),
      );
      return createErrorEvaluationDetail(ErrorKinds.FlagNotFound, defaultValue);
    }

    const { reason, value, variation } = foundItem.flag;

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
        this.emitter.emit('error', this.inputContext, error);
        return createErrorEvaluationDetail(ErrorKinds.WrongType, defaultValue);
      }
    }

    const successDetail = createSuccessEvaluationDetail(value, variation, reason);
    if (variation === undefined || variation === null) {
      this.logger.debug('Result value is null in variation');
      successDetail.value = defaultValue;
    }
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
}
