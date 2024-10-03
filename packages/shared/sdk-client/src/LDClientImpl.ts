import {
  AutoEnvAttributes,
  clone,
  Context,
  defaultHeaders,
  internal,
  LDClientError,
  LDContext,
  LDFlagSet,
  LDFlagValue,
  LDHeaders,
  LDLogger,
  Platform,
  subsystem,
  timedPromise,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

import { LDClient, type LDOptions } from './api';
import { LDEvaluationDetail, LDEvaluationDetailTyped } from './api/LDEvaluationDetail';
import { LDIdentifyOptions } from './api/LDIdentifyOptions';
import { Configuration, ConfigurationImpl, LDClientInternalOptions } from './configuration';
import { addAutoEnv } from './context/addAutoEnv';
import { ensureKey } from './context/ensureKey';
import { DataManager, DataManagerFactory } from './DataManager';
import createDiagnosticsManager from './diagnostics/createDiagnosticsManager';
import {
  createErrorEvaluationDetail,
  createSuccessEvaluationDetail,
} from './evaluation/evaluationDetail';
import createEventProcessor from './events/createEventProcessor';
import EventFactory from './events/EventFactory';
import DefaultFlagManager, { FlagManager } from './flag-manager/FlagManager';
import LDEmitter, { EventName } from './LDEmitter';

const { ClientMessages, ErrorKinds } = internal;

export default class LDClientImpl implements LDClient {
  private readonly config: Configuration;
  private uncheckedContext?: LDContext;
  private checkedContext?: Context;
  private readonly diagnosticsManager?: internal.DiagnosticsManager;
  private eventProcessor?: internal.EventProcessor;
  private identifyTimeout: number = 5;
  readonly logger: LDLogger;
  private updateProcessor?: subsystem.LDStreamProcessor;

  private readonly highTimeoutThreshold: number = 15;

  private eventFactoryDefault = new EventFactory(false);
  private eventFactoryWithReasons = new EventFactory(true);
  protected emitter: LDEmitter;
  private flagManager: FlagManager;

  private eventSendingEnabled: boolean = false;
  private baseHeaders: LDHeaders;
  protected dataManager: DataManager;

  /**
   * Creates the client object synchronously. No async, no network calls.
   */
  constructor(
    public readonly sdkKey: string,
    public readonly autoEnvAttributes: AutoEnvAttributes,
    public readonly platform: Platform,
    options: LDOptions,
    dataManagerFactory: DataManagerFactory,
    internalOptions?: LDClientInternalOptions,
  ) {
    if (!sdkKey) {
      throw new Error('You must configure the client with a client-side SDK key');
    }

    if (!platform.encoding) {
      throw new Error('Platform must implement Encoding because btoa is required.');
    }

    this.config = new ConfigurationImpl(options, internalOptions);
    this.logger = this.config.logger;

    this.baseHeaders = defaultHeaders(
      this.sdkKey,
      this.platform.info,
      this.config.tags,
      this.config.serviceEndpoints.includeAuthorizationHeader,
      this.config.userAgentHeaderName,
    );

    this.flagManager = new DefaultFlagManager(
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
    );
    this.emitter = new LDEmitter();
    this.emitter.on('error', (c: LDContext, err: any) => {
      this.logger.error(`error: ${err}, context: ${JSON.stringify(c)}`);
    });

    this.flagManager.on((context, flagKeys) => {
      const ldContext = Context.toLDContext(context);
      this.logger.debug(`change: context: ${JSON.stringify(ldContext)}, flags: ${flagKeys}`);
      this.emitter.emit('change', ldContext, flagKeys);
    });

    this.dataManager = dataManagerFactory(
      this.flagManager,
      this.config,
      this.baseHeaders,
      this.emitter,
      this.diagnosticsManager,
    );
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

  private createIdentifyPromise(timeout: number): {
    identifyPromise: Promise<void>;
    identifyResolve: () => void;
    identifyReject: (err: Error) => void;
  } {
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
    this.uncheckedContext = context;
    this.checkedContext = checkedContext;

    this.eventProcessor?.sendEvent(this.eventFactoryDefault.identifyEvent(this.checkedContext));
    const { identifyPromise, identifyResolve, identifyReject } = this.createIdentifyPromise(
      this.identifyTimeout,
    );
    this.logger.debug(`Identifying ${JSON.stringify(this.checkedContext)}`);

    await this.dataManager.identify(
      identifyResolve,
      identifyReject,
      checkedContext,
      identifyOptions,
    );

    return identifyPromise;
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
      const prereqFlag = this.flagManager.get(prereqKey);
      if (prereqFlag) {
        this.eventProcessor?.sendEvent(
          eventFactory.evalEventClient(
            prereqKey,
            prereqFlag.flag.value,
            undefined,
            prereqFlag.flag,
            evalContext,
            prereqFlag.flag.reason,
          ),
        );
      }
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
