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
  timedPromise,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

import { Hook, LDClient, type LDOptions } from './api';
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
import { FlagChangeType } from './flag-manager/FlagUpdater';
import HookRunner from './HookRunner';
import { getInspectorHook } from './inspection/getInspectorHook';
import InspectorManager from './inspection/InspectorManager';
import LDEmitter, { EventName } from './LDEmitter';

const { ClientMessages, ErrorKinds } = internal;

const DEFAULT_IDENIFY_TIMEOUT_SECONDS = 5;

export default class LDClientImpl implements LDClient {
  private readonly _config: Configuration;
  private _uncheckedContext?: LDContext;
  private _checkedContext?: Context;
  private readonly _diagnosticsManager?: internal.DiagnosticsManager;
  private _eventProcessor?: internal.EventProcessor;
  readonly logger: LDLogger;

  private readonly _highTimeoutThreshold: number = 15;

  private _eventFactoryDefault = new EventFactory(false);
  private _eventFactoryWithReasons = new EventFactory(true);
  protected emitter: LDEmitter;
  private _flagManager: FlagManager;

  private _eventSendingEnabled: boolean = false;
  private _baseHeaders: LDHeaders;
  protected dataManager: DataManager;
  private _hookRunner: HookRunner;
  private _inspectorManager: InspectorManager;

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

    this._config = new ConfigurationImpl(options, internalOptions);
    this.logger = this._config.logger;

    this._baseHeaders = defaultHeaders(
      this.sdkKey,
      this.platform.info,
      this._config.tags,
      this._config.serviceEndpoints.includeAuthorizationHeader,
      this._config.userAgentHeaderName,
    );

    this._flagManager = new DefaultFlagManager(
      this.platform,
      sdkKey,
      this._config.maxCachedContexts,
      this._config.logger,
    );
    this._diagnosticsManager = createDiagnosticsManager(sdkKey, this._config, platform);
    this._eventProcessor = createEventProcessor(
      sdkKey,
      this._config,
      platform,
      this._baseHeaders,
      this._diagnosticsManager,
    );
    this.emitter = new LDEmitter();
    this.emitter.on('error', (c: LDContext, err: any) => {
      this.logger.error(`error: ${err}, context: ${JSON.stringify(c)}`);
    });

    this._flagManager.on((context, flagKeys, type) => {
      this._handleInspectionChanged(flagKeys, type);
      const ldContext = Context.toLDContext(context);
      this.emitter.emit('change', ldContext, flagKeys);
      flagKeys.forEach((it) => {
        this.emitter.emit(`change:${it}`, ldContext);
      });
    });

    this.dataManager = dataManagerFactory(
      this._flagManager,
      this._config,
      this._baseHeaders,
      this.emitter,
      this._diagnosticsManager,
    );

    this._hookRunner = new HookRunner(this.logger, this._config.hooks);
    this._inspectorManager = new InspectorManager(this._config.inspectors, this.logger);
    if (this._inspectorManager.hasInspectors()) {
      this._hookRunner.addHook(getInspectorHook(this._inspectorManager));
    }
  }

  allFlags(): LDFlagSet {
    // extracting all flag values
    const result = Object.entries(this._flagManager.getAll()).reduce(
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
    this._eventProcessor?.close();
    this.dataManager.close();
    this.logger.debug('Closed event processor and data source.');
  }

  async flush(): Promise<{ error?: Error; result: boolean }> {
    try {
      await this._eventProcessor?.flush();
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
    return this._uncheckedContext ? clone<LDContext>(this._uncheckedContext) : undefined;
  }

  protected getInternalContext(): Context | undefined {
    return this._checkedContext;
  }

  private _createIdentifyPromise(
    timeout: number,
    noTimeout: boolean,
  ): {
    identifyPromise: Promise<void>;
    identifyResolve: () => void;
    identifyReject: (err: Error) => void;
  } {
    let res: any;
    let rej: any;

    const basePromise = new Promise<void>((resolve, reject) => {
      res = resolve;
      rej = reject;
    });

    if (noTimeout) {
      return { identifyPromise: basePromise, identifyResolve: res, identifyReject: rej };
    }

    const timed = timedPromise(timeout, 'identify');
    const raced = Promise.race([timed, basePromise]).catch((e) => {
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
    const identifyTimeout = identifyOptions?.timeout ?? DEFAULT_IDENIFY_TIMEOUT_SECONDS;
    const noTimeout = identifyOptions?.timeout === undefined && identifyOptions?.noTimeout === true;

    // When noTimeout is specified, and a timeout is not secified, then this condition cannot
    // be encountered. (Our default would need to be greater)
    if (identifyTimeout > this._highTimeoutThreshold) {
      this.logger.warn(
        'The identify function was called with a timeout greater than ' +
          `${this._highTimeoutThreshold} seconds. We recommend a timeout of less than ` +
          `${this._highTimeoutThreshold} seconds.`,
      );
    }

    let context = await ensureKey(pristineContext, this.platform);

    if (this.autoEnvAttributes === AutoEnvAttributes.Enabled) {
      context = await addAutoEnv(context, this.platform, this._config);
    }

    const checkedContext = Context.fromLDContext(context);
    if (!checkedContext.valid) {
      const error = new Error('Context was unspecified or had no key');
      this.emitter.emit('error', context, error);
      return Promise.reject(error);
    }
    this._uncheckedContext = context;
    this._checkedContext = checkedContext;

    this._eventProcessor?.sendEvent(this._eventFactoryDefault.identifyEvent(this._checkedContext));
    const { identifyPromise, identifyResolve, identifyReject } = this._createIdentifyPromise(
      identifyTimeout,
      noTimeout,
    );
    this.logger.debug(`Identifying ${JSON.stringify(this._checkedContext)}`);

    const afterIdentify = this._hookRunner.identify(context, identifyOptions?.timeout);

    await this.dataManager.identify(
      identifyResolve,
      identifyReject,
      checkedContext,
      identifyOptions,
    );

    return identifyPromise.then(
      (res) => {
        afterIdentify({ status: 'completed' });
        return res;
      },
      (e) => {
        afterIdentify({ status: 'error' });
        throw e;
      },
    );
  }

  on(eventName: EventName, listener: Function): void {
    this.emitter.on(eventName, listener);
  }

  off(eventName: EventName, listener: Function): void {
    this.emitter.off(eventName, listener);
  }

  track(key: string, data?: any, metricValue?: number): void {
    if (!this._checkedContext || !this._checkedContext.valid) {
      this.logger.warn(ClientMessages.MissingContextKeyNoEvent);
      return;
    }

    // 0 is valid, so do not truthy check the metric value
    if (metricValue !== undefined && !TypeValidators.Number.is(metricValue)) {
      this.logger?.warn(ClientMessages.invalidMetricValue(typeof metricValue));
    }

    this._eventProcessor?.sendEvent(
      this._config.trackEventModifier(
        this._eventFactoryDefault.customEvent(key, this._checkedContext!, data, metricValue),
      ),
    );
  }

  private _variationInternal(
    flagKey: string,
    defaultValue: any,
    eventFactory: EventFactory,
    typeChecker?: (value: any) => [boolean, string],
  ): LDEvaluationDetail {
    if (!this._uncheckedContext) {
      this.logger.debug(ClientMessages.MissingContextKeyNoEvent);
      return createErrorEvaluationDetail(ErrorKinds.UserNotSpecified, defaultValue);
    }

    const evalContext = Context.fromLDContext(this._uncheckedContext);
    const foundItem = this._flagManager.get(flagKey);

    if (foundItem === undefined || foundItem.flag.deleted) {
      const defVal = defaultValue ?? null;
      const error = new LDClientError(
        `Unknown feature flag "${flagKey}"; returning default value ${defVal}.`,
      );
      this.emitter.emit('error', this._uncheckedContext, error);
      this._eventProcessor?.sendEvent(
        this._eventFactoryDefault.unknownFlagEvent(flagKey, defVal, evalContext),
      );
      return createErrorEvaluationDetail(ErrorKinds.FlagNotFound, defaultValue);
    }

    const { reason, value, variation, prerequisites } = foundItem.flag;

    if (typeChecker) {
      const [matched, type] = typeChecker(value);
      if (!matched) {
        this._eventProcessor?.sendEvent(
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
        this.emitter.emit('error', this._uncheckedContext, error);
        return createErrorEvaluationDetail(ErrorKinds.WrongType, defaultValue);
      }
    }

    const successDetail = createSuccessEvaluationDetail(value, variation, reason);
    if (value === undefined || value === null) {
      this.logger.debug('Result value is null. Providing default value.');
      successDetail.value = defaultValue;
    }

    prerequisites?.forEach((prereqKey) => {
      this._variationInternal(prereqKey, undefined, this._eventFactoryDefault);
    });
    this._eventProcessor?.sendEvent(
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
    const { value } = this._hookRunner.withEvaluation(
      flagKey,
      this._uncheckedContext,
      defaultValue,
      () => this._variationInternal(flagKey, defaultValue, this._eventFactoryDefault),
    );
    return value;
  }
  variationDetail(flagKey: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
    return this._hookRunner.withEvaluation(flagKey, this._uncheckedContext, defaultValue, () =>
      this._variationInternal(flagKey, defaultValue, this._eventFactoryWithReasons),
    );
  }

  private _typedEval<T>(
    key: string,
    defaultValue: T,
    eventFactory: EventFactory,
    typeChecker: (value: unknown) => [boolean, string],
  ): LDEvaluationDetailTyped<T> {
    return this._hookRunner.withEvaluation(key, this._uncheckedContext, defaultValue, () =>
      this._variationInternal(key, defaultValue, eventFactory, typeChecker),
    );
  }

  boolVariation(key: string, defaultValue: boolean): boolean {
    return this._typedEval(key, defaultValue, this._eventFactoryDefault, (value) => [
      TypeValidators.Boolean.is(value),
      TypeValidators.Boolean.getType(),
    ]).value;
  }

  jsonVariation(key: string, defaultValue: unknown): unknown {
    return this.variation(key, defaultValue);
  }

  numberVariation(key: string, defaultValue: number): number {
    return this._typedEval(key, defaultValue, this._eventFactoryDefault, (value) => [
      TypeValidators.Number.is(value),
      TypeValidators.Number.getType(),
    ]).value;
  }

  stringVariation(key: string, defaultValue: string): string {
    return this._typedEval(key, defaultValue, this._eventFactoryDefault, (value) => [
      TypeValidators.String.is(value),
      TypeValidators.String.getType(),
    ]).value;
  }

  boolVariationDetail(key: string, defaultValue: boolean): LDEvaluationDetailTyped<boolean> {
    return this._typedEval(key, defaultValue, this._eventFactoryWithReasons, (value) => [
      TypeValidators.Boolean.is(value),
      TypeValidators.Boolean.getType(),
    ]);
  }

  numberVariationDetail(key: string, defaultValue: number): LDEvaluationDetailTyped<number> {
    return this._typedEval(key, defaultValue, this._eventFactoryWithReasons, (value) => [
      TypeValidators.Number.is(value),
      TypeValidators.Number.getType(),
    ]);
  }

  stringVariationDetail(key: string, defaultValue: string): LDEvaluationDetailTyped<string> {
    return this._typedEval(key, defaultValue, this._eventFactoryWithReasons, (value) => [
      TypeValidators.String.is(value),
      TypeValidators.String.getType(),
    ]);
  }

  jsonVariationDetail(key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown> {
    return this.variationDetail(key, defaultValue);
  }

  addHook(hook: Hook): void {
    this._hookRunner.addHook(hook);
  }

  /**
   * Enable/Disable event sending.
   * @param enabled True to enable event processing, false to disable.
   * @param flush True to flush while disabling. Useful to flush on certain state transitions.
   */
  protected setEventSendingEnabled(enabled: boolean, flush: boolean): void {
    if (this._eventSendingEnabled === enabled) {
      return;
    }
    this._eventSendingEnabled = enabled;

    if (enabled) {
      this.logger.debug('Starting event processor');
      this._eventProcessor?.start();
    } else if (flush) {
      this.logger?.debug('Flushing event processor before disabling.');
      // Disable and flush.
      this.flush().then(() => {
        // While waiting for the flush event sending could be re-enabled, in which case
        // we do not want to close the event processor.
        if (!this._eventSendingEnabled) {
          this.logger?.debug('Stopping event processor.');
          this._eventProcessor?.close();
        }
      });
    } else {
      // Just disabled.
      this.logger?.debug('Stopping event processor.');
      this._eventProcessor?.close();
    }
  }

  protected sendEvent(event: internal.InputEvent): void {
    this._eventProcessor?.sendEvent(event);
  }

  private _handleInspectionChanged(flagKeys: Array<string>, type: FlagChangeType) {
    if (!this._inspectorManager.hasInspectors()) {
      return;
    }

    const details: Record<string, LDEvaluationDetail> = {};
    flagKeys.forEach((flagKey) => {
      const item = this._flagManager.get(flagKey);
      if (item?.flag && !item.flag.deleted) {
        const { reason, value, variation } = item.flag;
        details[flagKey] = createSuccessEvaluationDetail(value, variation, reason);
      } else {
        details[flagKey] = {
          value: undefined,
          // For backwards compatibility purposes reason and variationIndex are null instead of
          // being undefined.
          reason: null,
          variationIndex: null,
        };
      }
    });
    if (type === 'init') {
      this._inspectorManager.onFlagsChanged(details);
    } else if (type === 'patch') {
      Object.entries(details).forEach(([flagKey, detail]) => {
        this._inspectorManager.onFlagChanged(flagKey, detail);
      });
    }
  }
}
