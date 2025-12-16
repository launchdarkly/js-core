import {
  AutoEnvAttributes,
  base64UrlEncode,
  BasicLogger,
  cancelableTimedPromise,
  Configuration,
  Encoding,
  FlagManager,
  Hook,
  internal,
  LDClientImpl,
  LDContext,
  LDEmitter,
  LDEmitterEventName,
  LDFlagValue,
  LDHeaders,
  LDIdentifyResult,
  LDPluginEnvironmentMetadata,
  Platform,
  safeRegisterDebugOverridePlugins,
} from '@launchdarkly/js-client-sdk-common';

import { readFlagsFromBootstrap } from './bootstrap';
import { getHref } from './BrowserApi';
import BrowserDataManager from './BrowserDataManager';
import { BrowserIdentifyOptions as LDIdentifyOptions } from './BrowserIdentifyOptions';
import { registerStateDetection } from './BrowserStateDetector';
import GoalManager from './goals/GoalManager';
import { Goal, isClick } from './goals/Goals';
import {
  LDClient,
  LDStartOptions,
  LDWaitForInitializationComplete,
  LDWaitForInitializationFailed,
  LDWaitForInitializationOptions,
  LDWaitForInitializationResult,
  LDWaitForInitializationTimeout,
} from './LDClient';
import { LDPlugin } from './LDPlugin';
import validateBrowserOptions, { BrowserOptions, filterToBaseOptionsWithDefaults } from './options';
import BrowserPlatform from './platform/BrowserPlatform';

class BrowserClientImpl extends LDClientImpl {
  private readonly _goalManager?: GoalManager;
  private readonly _plugins?: LDPlugin[];
  private _waitForInitializedPromise?: Promise<LDWaitForInitializationResult>;
  private _initResolve?: (result: LDWaitForInitializationResult) => void;
  private _initializeResult?: LDWaitForInitializationResult;

  private _initialContext?: LDContext;

  // NOTE: This also keeps track of when we tried to initialize the client.
  private _initializePromise?: Promise<LDWaitForInitializationResult>;

  constructor(
    clientSideId: string,
    autoEnvAttributes: AutoEnvAttributes,
    options: BrowserOptions = {},
    overridePlatform?: Platform,
  ) {
    const { logger: customLogger, debug } = options;
    // Overrides the default logger from the common implementation.
    const logger =
      customLogger ??
      new BasicLogger({
        destination: {
          // eslint-disable-next-line no-console
          debug: console.debug,
          // eslint-disable-next-line no-console
          info: console.info,
          // eslint-disable-next-line no-console
          warn: console.warn,
          // eslint-disable-next-line no-console
          error: console.error,
        },
        level: debug ? 'debug' : 'info',
      });

    // TODO: Use the already-configured baseUri from the SDK config. SDK-560
    const baseUrl = options.baseUri ?? 'https://clientsdk.launchdarkly.com';

    const platform = overridePlatform ?? new BrowserPlatform(logger, options);
    // Only the browser-specific options are in validatedBrowserOptions.
    const validatedBrowserOptions = validateBrowserOptions(options, logger);
    // The base options are in baseOptionsWithDefaults.
    const baseOptionsWithDefaults = filterToBaseOptionsWithDefaults({ ...options, logger });
    const { eventUrlTransformer } = validatedBrowserOptions;

    super(
      clientSideId,
      autoEnvAttributes,
      platform,
      baseOptionsWithDefaults,
      (
        flagManager: FlagManager,
        configuration: Configuration,
        baseHeaders: LDHeaders,
        emitter: LDEmitter,
        diagnosticsManager?: internal.DiagnosticsManager,
      ) =>
        new BrowserDataManager(
          platform,
          flagManager,
          clientSideId,
          configuration,
          validatedBrowserOptions,
          () => ({
            pathGet(encoding: Encoding, _plainContextString: string): string {
              return `/sdk/evalx/${clientSideId}/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
            },
            pathReport(_encoding: Encoding, _plainContextString: string): string {
              return `/sdk/evalx/${clientSideId}/context`;
            },
            pathPing(_encoding: Encoding, _plainContextString: string): string {
              // Note: if you are seeing this error, it is a coding error. This DataSourcePaths implementation is for polling endpoints. /ping is not currently
              // used in a polling situation. It is probably the case that this was called by streaming logic erroneously.
              throw new Error('Ping for polling unsupported.');
            },
          }),
          () => ({
            pathGet(encoding: Encoding, _plainContextString: string): string {
              return `/eval/${clientSideId}/${base64UrlEncode(_plainContextString, encoding)}`;
            },
            pathReport(_encoding: Encoding, _plainContextString: string): string {
              return `/eval/${clientSideId}`;
            },
            pathPing(_encoding: Encoding, _plainContextString: string): string {
              return `/ping/${clientSideId}`;
            },
          }),
          baseHeaders,
          emitter,
          diagnosticsManager,
        ),
      {
        analyticsEventPath: `/events/bulk/${clientSideId}`,
        diagnosticEventPath: `/events/diagnostic/${clientSideId}`,
        includeAuthorizationHeader: false,
        highTimeoutThreshold: 5,
        userAgentHeaderName: 'x-launchdarkly-user-agent',
        trackEventModifier: (event: internal.InputCustomEvent) =>
          new internal.InputCustomEvent(
            event.context,
            event.key,
            event.data,
            event.metricValue,
            event.samplingRatio,
            eventUrlTransformer(getHref()),
          ),
        getImplementationHooks: (environmentMetadata: LDPluginEnvironmentMetadata) =>
          internal.safeGetHooks(logger, environmentMetadata, validatedBrowserOptions.plugins),
        credentialType: 'clientSideId',
      },
    );

    this.setEventSendingEnabled(true, false);

    this._plugins = validatedBrowserOptions.plugins;

    if (validatedBrowserOptions.fetchGoals) {
      this._goalManager = new GoalManager(
        clientSideId,
        platform.requests,
        baseUrl,
        (err) => {
          // TODO: May need to emit. SDK-561
          logger.error(err.message);
        },
        (url: string, goal: Goal) => {
          const context = this.getInternalContext();
          if (!context) {
            return;
          }
          const transformedUrl = eventUrlTransformer(url);
          if (isClick(goal)) {
            this.sendEvent({
              kind: 'click',
              url: transformedUrl,
              samplingRatio: 1,
              key: goal.key,
              creationDate: Date.now(),
              context,
              selector: goal.selector,
            });
          } else {
            this.sendEvent({
              kind: 'pageview',
              url: transformedUrl,
              samplingRatio: 1,
              key: goal.key,
              creationDate: Date.now(),
              context,
            });
          }
        },
      );

      // This is intentionally not awaited. If we want to add a "goalsready" event, or
      // "waitForGoalsReady", then we would make an async immediately invoked function expression
      // which emits the event, and assign its promise to a member. The "waitForGoalsReady" function
      // would return that promise.
      this._goalManager.initialize();

      if (validatedBrowserOptions.automaticBackgroundHandling) {
        registerStateDetection(() => this.flush());
      }
    }
  }

  registerPlugins(client: LDClient): void {
    internal.safeRegisterPlugins(
      this.logger,
      this.environmentMetadata,
      client,
      this._plugins || [],
    );

    const override = this.getDebugOverrides();
    if (override) {
      safeRegisterDebugOverridePlugins(this.logger, override, this._plugins || []);
    }
  }

  setInitialContext(context: LDContext): void {
    this._initialContext = context;
  }

  start(options?: LDStartOptions): Promise<LDWaitForInitializationResult> {
    if (this._initializeResult) {
      return Promise.resolve(this._initializeResult);
    }
    if (this._initializePromise) {
      return this._initializePromise;
    }
    if (!this._initialContext) {
      this.logger.error('Initial context not set');
      return Promise.resolve({ status: 'failed', error: new Error('Initial context not set') });
    }

    const identifyOptions = options?.identifyOptions ?? {};

    if (identifyOptions?.bootstrap) {
      try {
        const bootstrapData = readFlagsFromBootstrap(this.logger, identifyOptions.bootstrap);
        this.presetFlags(bootstrapData);
      } catch (error) {
        this.logger.error('Failed to bootstrap data', error);
      }
    }

    const identifyPromise = new Promise<LDWaitForInitializationResult>((resolve) => {
      this.identifyResult(this._initialContext!, identifyOptions).then((result) => {
        if (result.status === 'timeout') {
          resolve({ status: 'timeout' });
        } else if (result.status === 'error') {
          resolve({ status: 'failed', error: result.error });
        }
        resolve({ status: 'complete' });
      });
    });

    this._initializePromise = this._promiseWithTimeout(identifyPromise, options?.timeout ?? 5);
    return this._initializePromise;
  }

  override async identify(context: LDContext, identifyOptions?: LDIdentifyOptions): Promise<void> {
    return super.identify(context, identifyOptions);
  }

  override async identifyResult(
    context: LDContext,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<LDIdentifyResult> {
    const identifyOptionsWithUpdatedDefaults = {
      ...identifyOptions,
    };
    if (identifyOptions?.sheddable === undefined) {
      identifyOptionsWithUpdatedDefaults.sheddable = true;
    }

    const res = await super.identifyResult(context, identifyOptionsWithUpdatedDefaults);
    if (res.status === 'completed') {
      this._initializeResult = { status: 'complete' };
      this._initResolve?.(this._initializeResult);
    } else if (res.status === 'error') {
      this._initializeResult = { status: 'failed', error: res.error };
      this._initResolve?.(this._initializeResult);
    }

    this._goalManager?.startTracking();
    return res;
  }

  waitForInitialization(
    options?: LDWaitForInitializationOptions,
  ): Promise<LDWaitForInitializationResult> {
    const timeout = options?.timeout ?? 5;

    // If initialization has already completed (successfully or failed), return the result immediately.
    if (this._initializeResult) {
      return Promise.resolve(this._initializeResult);
    }

    // It waitForInitialization was previously called, then return the promise with a timeout.
    // This condition should only be triggered if waitForInitialization was called multiple times.
    if (this._waitForInitializedPromise) {
      return this._promiseWithTimeout(this._waitForInitializedPromise, timeout);
    }

    if (!this._waitForInitializedPromise) {
      this._waitForInitializedPromise = new Promise((resolve) => {
        this._initResolve = resolve;
      });
    }

    return this._promiseWithTimeout(this._waitForInitializedPromise, timeout);
  }

  /**
   * Apply a timeout promise to a base promise. This is for use with waitForInitialization.
   *
   * @param basePromise The promise to race against a timeout.
   * @param timeout The timeout in seconds.
   * @param logger A logger to log when the timeout expires.
   * @returns
   */
  private _promiseWithTimeout(
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

  setStreaming(streaming?: boolean): void {
    // With FDv2 we may want to consider if we support connection mode directly.
    // Maybe with an extension to connection mode for 'automatic'.
    const browserDataManager = this.dataManager as BrowserDataManager;
    browserDataManager.setForcedStreaming(streaming);
  }

  private _updateAutomaticStreamingState() {
    const browserDataManager = this.dataManager as BrowserDataManager;
    // This will need changed if support for listening to individual flag change
    // events it added.
    browserDataManager.setAutomaticStreamingState(!!this.emitter.listenerCount('change'));
  }

  override on(eventName: LDEmitterEventName, listener: Function): void {
    super.on(eventName, listener);
    this._updateAutomaticStreamingState();
  }

  override off(eventName: LDEmitterEventName, listener: Function): void {
    super.off(eventName, listener);
    this._updateAutomaticStreamingState();
  }
}

export function makeClient(
  clientSideId: string,
  autoEnvAttributes: AutoEnvAttributes,
  options: BrowserOptions = {},
  overridePlatform?: Platform,
): LDClient {
  const impl = new BrowserClientImpl(clientSideId, autoEnvAttributes, options, overridePlatform);

  // Return a PIMPL style implementation. This decouples the interface from the interface of the implementation.
  // In the future we should consider updating the common SDK code to not use inheritance and instead compose
  // the leaf-implementation.
  // The purpose for this in the short-term is to have a signature for identify that is different than the class implementation.
  // Using an object with PIMPL here also allows us to completely hide the underlying implementation, where with a class
  // it is trivial to access what should be protected (or even private) fields.
  const client: LDClient = {
    variation: (key: string, defaultValue?: LDFlagValue) => impl.variation(key, defaultValue),
    variationDetail: (key: string, defaultValue?: LDFlagValue) =>
      impl.variationDetail(key, defaultValue),
    boolVariation: (key: string, defaultValue: boolean) => impl.boolVariation(key, defaultValue),
    boolVariationDetail: (key: string, defaultValue: boolean) =>
      impl.boolVariationDetail(key, defaultValue),
    numberVariation: (key: string, defaultValue: number) => impl.numberVariation(key, defaultValue),
    numberVariationDetail: (key: string, defaultValue: number) =>
      impl.numberVariationDetail(key, defaultValue),
    stringVariation: (key: string, defaultValue: string) => impl.stringVariation(key, defaultValue),
    stringVariationDetail: (key: string, defaultValue: string) =>
      impl.stringVariationDetail(key, defaultValue),
    jsonVariation: (key: string, defaultValue: unknown) => impl.jsonVariation(key, defaultValue),
    jsonVariationDetail: (key: string, defaultValue: unknown) =>
      impl.jsonVariationDetail(key, defaultValue),
    track: (key: string, data?: any, metricValue?: number) => impl.track(key, data, metricValue),
    on: (key: LDEmitterEventName, callback: (...args: any[]) => void) => impl.on(key, callback),
    off: (key: LDEmitterEventName, callback: (...args: any[]) => void) => impl.off(key, callback),
    flush: () => impl.flush(),
    setStreaming: (streaming?: boolean) => impl.setStreaming(streaming),
    identify: (pristineContext: LDContext, identifyOptions?: LDIdentifyOptions) =>
      impl.identifyResult(pristineContext, identifyOptions),
    getContext: () => impl.getContext(),
    close: () => impl.close(),
    allFlags: () => impl.allFlags(),
    addHook: (hook: Hook) => impl.addHook(hook),
    waitForInitialization: (waitOptions?: LDWaitForInitializationOptions) =>
      impl.waitForInitialization(waitOptions),
    logger: impl.logger,
    setInitialContext: (context: LDContext) => impl.setInitialContext(context),
    start: (startOptions?: LDStartOptions) => impl.start(startOptions),
  };

  impl.registerPlugins(client);

  return client;
}
