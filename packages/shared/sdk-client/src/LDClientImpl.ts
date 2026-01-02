import {
  AutoEnvAttributes,
  cancelableTimedPromise,
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
  LDPluginEnvironmentMetadata,
  LDTimeoutError,
  Platform,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

import {
  Hook,
  LDClient,
  LDClientIdentifyResult,
  LDIdentifyError,
  LDIdentifyResult,
  LDIdentifyShed,
  LDIdentifySuccess,
  LDIdentifyTimeout,
  type LDOptions,
  LDWaitForInitializationComplete,
  LDWaitForInitializationFailed,
  LDWaitForInitializationOptions,
  LDWaitForInitializationResult,
  LDWaitForInitializationTimeout,
} from './api';
import { LDEvaluationDetail, LDEvaluationDetailTyped } from './api/LDEvaluationDetail';
import { LDIdentifyOptions } from './api/LDIdentifyOptions';
import { createAsyncTaskQueue } from './async/AsyncTaskQueue';
import { Configuration, ConfigurationImpl, LDClientInternalOptions } from './configuration';
import { addAutoEnv } from './context/addAutoEnv';
import {
  ActiveContextTracker,
  createActiveContextTracker,
} from './context/createActiveContextTracker';
import { ensureKey } from './context/ensureKey';
import { DataManager, DataManagerFactory } from './DataManager';
import createDiagnosticsManager from './diagnostics/createDiagnosticsManager';
import {
  createErrorEvaluationDetail,
  createSuccessEvaluationDetail,
} from './evaluation/evaluationDetail';
import createEventProcessor from './events/createEventProcessor';
import EventFactory from './events/EventFactory';
import DefaultFlagManager, { FlagManager, LDDebugOverride } from './flag-manager/FlagManager';
import { FlagChangeType } from './flag-manager/FlagUpdater';
import { ItemDescriptor } from './flag-manager/ItemDescriptor';
import HookRunner from './HookRunner';
import { getInspectorHook } from './inspection/getInspectorHook';
import InspectorManager from './inspection/InspectorManager';
import LDEmitter, { EventName } from './LDEmitter';
import { createPluginEnvironmentMetadata } from './plugins/createPluginEnvironmentMetadata';

const { ClientMessages, ErrorKinds } = internal;

const DEFAULT_IDENTIFY_TIMEOUT_SECONDS = 5;

export default class LDClientImpl implements LDClient, LDClientIdentifyResult {
  private readonly _config: Configuration;
  private readonly _diagnosticsManager?: internal.DiagnosticsManager;
  private _eventProcessor?: internal.EventProcessor;
  readonly logger: LDLogger;

  private _activeContextTracker: ActiveContextTracker = createActiveContextTracker();

  private readonly _highTimeoutThreshold: number = 15;

  private _eventFactoryDefault = new EventFactory(false);
  private _eventFactoryWithReasons = new EventFactory(true);
  protected emitter: LDEmitter;
  private _flagManager: FlagManager;

  private _eventSendingEnabled: boolean = false;
  private _baseHeaders: LDHeaders;
  protected dataManager: DataManager;
  protected readonly environmentMetadata: LDPluginEnvironmentMetadata;
  private _hookRunner: HookRunner;
  private _inspectorManager: InspectorManager;
  private _identifyQueue = createAsyncTaskQueue<void>();

  // The initialized promise is used to track the initialization state of the client.
  // This is separate from identify operations because initialization may complete
  // through the first identify call.
  protected initializedPromise?: Promise<LDWaitForInitializationResult>;
  protected initResolve?: (result: LDWaitForInitializationResult) => void;
  protected initializeResult?: LDWaitForInitializationResult;

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

    const hooks: Hook[] = [...this._config.hooks];

    this.environmentMetadata = createPluginEnvironmentMetadata(
      this.sdkKey,
      this.platform,
      this._config,
    );

    this._config.getImplementationHooks(this.environmentMetadata).forEach((hook) => {
      hooks.push(hook);
    });

    this._hookRunner = new HookRunner(this.logger, hooks);
    this._inspectorManager = new InspectorManager(this._config.inspectors, this.logger);
    if (this._inspectorManager.hasInspectors()) {
      this._hookRunner.addHook(getInspectorHook(this._inspectorManager));
    }

    if (
      options.cleanOldPersistentData &&
      internalOptions?.getLegacyStorageKeys &&
      this.platform.storage
    ) {
      // NOTE: we are letting this fail silently because it's not critical and we don't want to block the client from initializing.
      try {
        this.logger.debug('Cleaning old persistent data.');
        Promise.all(
          internalOptions.getLegacyStorageKeys().map((key) => this.platform.storage?.clear(key)),
        )
          .catch((error) => {
            this.logger.error(`Error cleaning old persistent data: ${error}`);
          })
          .finally(() => {
            this.logger.debug('Cleaned old persistent data.');
          });
      } catch (error) {
        this.logger.error(`Error cleaning old persistent data: ${error}`);
      }
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
    // We are returning an LDContext here to maintain a consistent representation of context to the consuming
    // code.  We are returned the unchecked context so that if a consumer identifies with an invalid context
    // and then calls getContext, they get back the same context they provided, without any assertion about
    // validity.
    return this._activeContextTracker.hasContext()
      ? clone<LDContext>(this._activeContextTracker.getUnwrappedContext())
      : undefined;
  }

  protected getInternalContext(): Context | undefined {
    return this._activeContextTracker.getContext();
  }

  /**
   * Preset flags are used to set the flags before the client is initialized. This is useful for
   * when client has precached flags that are ready to evaluate without full initialization.
   * @param newFlags - The flags to preset.
   */
  protected presetFlags(newFlags: { [key: string]: ItemDescriptor }) {
    this._flagManager.presetFlags(newFlags);
  }

  /**
   * Identifies a context to LaunchDarkly. See {@link LDClient.identify}.
   *
   * If used with the `sheddable` option set to true, then the identify operation will be sheddable. This means that if
   * multiple identify operations are done, without waiting for the previous one to complete, then intermediate
   * operations may be discarded.
   *
   * It is recommended to use the `identifyResult` method instead when the operation is sheddable. In a future release,
   * all identify operations will default to being sheddable.
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
  async identify(pristineContext: LDContext, identifyOptions?: LDIdentifyOptions): Promise<void | LDIdentifyResult> {
    if (identifyOptions?.returnResults) {
      return this.identifyResult(pristineContext, identifyOptions);
    }

    this.logger.warn('The identify method will return a promise with the result of the identification operation in the future. To avoid this warning, set the `returnResults` option to true.');
    // In order to manage customization in the derived classes it is important that `identify` MUST be implemented in
    // terms of `identifyResult`. So that the logic of the identification process can be extended in one place.
    const result = await this.identifyResult(pristineContext, identifyOptions);
    if (result.status === 'error') {
      throw result.error;
    } else if (result.status === 'timeout') {
      const timeoutError = new LDTimeoutError(
        `identify timed out after ${result.timeout} seconds.`,
      );
      this.logger.error(timeoutError.message);
      throw timeoutError;
    }
    // If completed or shed, then we are done.
  }

  async identifyResult(
    pristineContext: LDContext,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<LDIdentifyResult> {
    const identifyTimeout = identifyOptions?.timeout ?? DEFAULT_IDENTIFY_TIMEOUT_SECONDS;
    const noTimeout = identifyOptions?.timeout === undefined && identifyOptions?.noTimeout === true;

    // When noTimeout is specified, and a timeout is not specified, then this condition cannot
    // be encountered. (Our default would need to be greater)
    if (identifyTimeout > this._highTimeoutThreshold) {
      this.logger.warn(
        'The identify function was called with a timeout greater than ' +
          `${this._highTimeoutThreshold} seconds. We recommend a timeout of less than ` +
          `${this._highTimeoutThreshold} seconds.`,
      );
    }

    const callSitePromise = this._identifyQueue
      .execute(
        {
          before: async () => {
            let context = await ensureKey(pristineContext, this.platform);
            if (this.autoEnvAttributes === AutoEnvAttributes.Enabled) {
              context = await addAutoEnv(context, this.platform, this._config);
            }
            const checkedContext = Context.fromLDContext(context);
            if (checkedContext.valid) {
              const afterIdentify = this._hookRunner.identify(context, identifyOptions?.timeout);
              return {
                context,
                checkedContext,
                afterIdentify,
              };
            }
            return {
              context,
              checkedContext,
            };
          },
          execute: async (beforeResult) => {
            const { context, checkedContext } = beforeResult!;
            if (!checkedContext.valid) {
              const error = new Error('Context was unspecified or had no key');
              this.emitter.emit('error', context, error);
              return Promise.reject(error);
            }
            this._activeContextTracker.set(context, checkedContext);

            this._eventProcessor?.sendEvent(
              this._eventFactoryDefault.identifyEvent(checkedContext),
            );
            const { identifyPromise, identifyResolve, identifyReject } =
              this._activeContextTracker.newIdentificationPromise();
            this.logger.debug(`Identifying ${JSON.stringify(checkedContext)}`);

            await this.dataManager.identify(
              identifyResolve,
              identifyReject,
              checkedContext,
              identifyOptions,
            );

            return identifyPromise;
          },
          after: async (res, beforeResult) => {
            if (res.status === 'complete') {
              beforeResult?.afterIdentify?.({ status: 'completed' });
            } else if (res.status === 'shed') {
              beforeResult?.afterIdentify?.({ status: 'shed' });
            } else if (res.status === 'error') {
              beforeResult?.afterIdentify?.({ status: 'error' });
            }
          },
        },
        identifyOptions?.sheddable ?? false,
      )
      .then((res) => {
        if (res.status === 'error') {
          const errorResult = { status: 'error', error: res.error } as LDIdentifyError;
          // Track initialization state for waitForInitialization
          this.maybeSetInitializationResult({ status: 'failed', error: res.error });
          return errorResult;
        }
        if (res.status === 'shed') {
          return { status: 'shed' } as LDIdentifyShed;
        }
        const successResult = { status: 'completed' } as LDIdentifySuccess;
        // Track initialization state for waitForInitialization
        this.maybeSetInitializationResult({ status: 'complete' });
        return successResult;
      });

    if (noTimeout) {
      return callSitePromise;
    }

    const timeoutPromise = new Promise<LDIdentifyTimeout>((resolve) => {
      setTimeout(() => {
        resolve({ status: 'timeout', timeout: identifyTimeout } as LDIdentifyTimeout);
      }, identifyTimeout * 1000);
    });
    return Promise.race([callSitePromise, timeoutPromise]);
  }

  /**
   * Sets the initialization result and resolves any pending waitForInitialization promises.
   * This method is idempotent and will only be set by the initialization flow. Subsequent calls
   * should not do anything.
   * @param result The initialization result.
   */
  protected maybeSetInitializationResult(result: LDWaitForInitializationResult): void {
    if (this.initializeResult === undefined) {
      this.initializeResult = result;
      this.emitter.emit('ready');
      if (result.status === 'complete') {
        this.emitter.emit('initialized');
      }
      if (this.initResolve) {
        this.initResolve(result);
        this.initResolve = undefined;
      }
    }
  }

  waitForInitialization(
    options?: LDWaitForInitializationOptions,
  ): Promise<LDWaitForInitializationResult> {
    const timeout = options?.timeout ?? 5;

    // If initialization has already completed (successfully or failed), return the result immediately.
    if (this.initializeResult) {
      return Promise.resolve(this.initializeResult);
    }

    // If waitForInitialization was previously called, then return the promise with a timeout.
    // This condition should only be triggered if waitForInitialization was called multiple times.
    if (this.initializedPromise) {
      return this.promiseWithTimeout(this.initializedPromise, timeout);
    }

    // Create a new promise for tracking initialization
    if (!this.initializedPromise) {
      this.initializedPromise = new Promise((resolve) => {
        this.initResolve = resolve;
      });
    }

    return this.promiseWithTimeout(this.initializedPromise, timeout);
  }

  /**
   * Apply a timeout promise to a base promise. This is for use with waitForInitialization.
   *
   * @param basePromise The promise to race against a timeout.
   * @param timeout The timeout in seconds.
   * @returns A promise that resolves to the initialization result or timeout.
   *
   * @privateRemarks
   * This method is protected because it is used by the browser SDK's `start` method.
   * Eventually, the start method will be moved to this common implementation and this method will
   * be made private.
   */
  protected promiseWithTimeout(
    basePromise: Promise<LDWaitForInitializationResult>,
    timeout: number,
  ): Promise<LDWaitForInitializationResult> {
    const cancelableTimeout = cancelableTimedPromise(timeout, 'waitForInitialization');
    return Promise.race([
      basePromise.then((res: LDWaitForInitializationResult) => {
        cancelableTimeout.cancel();
        return res;
      }),
      cancelableTimeout.promise
        // If the promise resolves without error, then the initialization completed successfully.
        // NOTE: this should never return as the resolution would only be triggered by the basePromise
        // being resolved.
        .then(() => ({ status: 'complete' }) as LDWaitForInitializationComplete)
        .catch(() => ({ status: 'timeout' }) as LDWaitForInitializationTimeout),
    ]).catch((reason) => {
      this.logger?.error(reason.message);
      return { status: 'failed', error: reason as Error } as LDWaitForInitializationFailed;
    });
  }

  on(eventName: EventName, listener: Function): void {
    this.emitter.on(eventName, listener);
  }

  off(eventName: EventName, listener: Function): void {
    this.emitter.off(eventName, listener);
  }

  track(key: string, data?: any, metricValue?: number): void {
    if (!this._activeContextTracker.hasValidContext()) {
      this.logger.warn(ClientMessages.MissingContextKeyNoEvent);
      return;
    }

    // 0 is valid, so do not truthy check the metric value
    if (metricValue !== undefined && !TypeValidators.Number.is(metricValue)) {
      this.logger?.warn(ClientMessages.invalidMetricValue(typeof metricValue));
    }

    this._eventProcessor?.sendEvent(
      this._config.trackEventModifier(
        this._eventFactoryDefault.customEvent(
          key,
          this._activeContextTracker.getContext()!,
          data,
          metricValue,
        ),
      ),
    );

    this._hookRunner.afterTrack({
      key,
      // The context is pre-checked above, so we know it can be unwrapped.
      context: this._activeContextTracker.getUnwrappedContext()!,
      data,
      metricValue,
    });
  }

  private _variationInternal(
    flagKey: string,
    defaultValue: any,
    eventFactory: EventFactory,
    typeChecker?: (value: any) => [boolean, string],
  ): LDEvaluationDetail {
    // We are letting evaulations happen without a context. The main case for this
    // is when cached data is loaded, but the client is not fully initialized. In this
    // case, we will write out a warning for each evaluation attempt.

    // NOTE: we will be changing this behavior soon once we have a tracker on the
    // client initialization state.
    const hasContext = this._activeContextTracker.hasContext();
    if (!hasContext) {
      this.logger?.warn(
        'Flag evaluation called before client is fully initialized, data from this evaulation could be stale.',
      );
    }

    const evalContext = this._activeContextTracker.getContext()!;
    const foundItem = this._flagManager.get(flagKey);

    if (foundItem === undefined || foundItem.flag.deleted) {
      const defVal = defaultValue ?? null;
      const error = new LDClientError(
        `Unknown feature flag "${flagKey}"; returning default value ${defVal}.`,
      );

      this.emitter.emit('error', this._activeContextTracker.getUnwrappedContext(), error);
      if (hasContext) {
        this._eventProcessor?.sendEvent(
          this._eventFactoryDefault.unknownFlagEvent(flagKey, defVal, evalContext),
        );
      }
      return createErrorEvaluationDetail(ErrorKinds.FlagNotFound, defaultValue);
    }

    const { reason, value, variation, prerequisites } = foundItem.flag;

    if (typeChecker) {
      const [matched, type] = typeChecker(value);
      if (!matched) {
        if (hasContext) {
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
        }
        const error = new LDClientError(
          `Wrong type "${type}" for feature flag "${flagKey}"; returning default value`,
        );
        this.emitter.emit('error', this._activeContextTracker.getUnwrappedContext(), error);
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
    if (hasContext) {
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
    }
    return successDetail;
  }

  variation(flagKey: string, defaultValue?: LDFlagValue): LDFlagValue {
    const { value } = this._hookRunner.withEvaluation(
      flagKey,
      this._activeContextTracker.getUnwrappedContext(),
      defaultValue,
      () => this._variationInternal(flagKey, defaultValue, this._eventFactoryDefault),
    );
    return value;
  }
  variationDetail(flagKey: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
    return this._hookRunner.withEvaluation(
      flagKey,
      this._activeContextTracker.getUnwrappedContext(),
      defaultValue,
      () => this._variationInternal(flagKey, defaultValue, this._eventFactoryWithReasons),
    );
  }

  private _typedEval<T>(
    key: string,
    defaultValue: T,
    eventFactory: EventFactory,
    typeChecker: (value: unknown) => [boolean, string],
  ): LDEvaluationDetailTyped<T> {
    return this._hookRunner.withEvaluation(
      key,
      this._activeContextTracker.getUnwrappedContext(),
      defaultValue,
      () => this._variationInternal(key, defaultValue, eventFactory, typeChecker),
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

  protected getDebugOverrides(): LDDebugOverride | undefined {
    return this._flagManager.getDebugOverride?.();
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

    // NOTE: we are not tracking "override" changes because, at the time of writing,
    // these changes are only used for debugging purposes and are not persisted. This
    // may change in the future.
    if (type === 'init') {
      this._inspectorManager.onFlagsChanged(details);
    } else if (type === 'patch') {
      Object.entries(details).forEach(([flagKey, detail]) => {
        this._inspectorManager.onFlagChanged(flagKey, detail);
      });
    }
  }
}
