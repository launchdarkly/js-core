import {
  AutoEnvAttributes,
  BasicLogger,
  BROWSER_DATA_SYSTEM_DEFAULTS,
  BROWSER_TRANSITION_TABLE,
  browserFdv1Endpoints,
  Configuration,
  createDefaultSourceFactoryProvider,
  createFDv2DataManagerBase,
  FDv2ConnectionMode,
  FlagManager,
  Hook,
  internal,
  LDIdentifyOptions as LDBaseIdentifyOptions,
  LDClientImpl,
  LDContext,
  LDEmitter,
  LDEmitterEventName,
  LDFlagValue,
  LDHeaders,
  LDIdentifyResult,
  LDPluginEnvironmentMetadata,
  LDWaitForInitializationOptions,
  LDWaitForInitializationResult,
  MODE_TABLE,
  Platform,
  readFlagsFromBootstrap,
  resolveForegroundMode,
  safeRegisterDebugOverridePlugins,
} from '@launchdarkly/js-client-sdk-common';

import { getHref } from './BrowserApi';
import BrowserDataManager from './BrowserDataManager';
import { BrowserIdentifyOptions as LDIdentifyOptions } from './BrowserIdentifyOptions';
import { registerStateDetection } from './BrowserStateDetector';
import GoalManager from './goals/GoalManager';
import { Goal, isClick } from './goals/Goals';
import { LDClient, LDStartOptions } from './LDClient';
import { LDPlugin } from './LDPlugin';
import validateBrowserOptions, { BrowserOptions, filterToBaseOptionsWithDefaults } from './options';
import BrowserPlatform from './platform/BrowserPlatform';
import { getAllStorageKeys } from './platform/LocalStorage';

class BrowserClientImpl extends LDClientImpl {
  private readonly _goalManager?: GoalManager;
  private readonly _plugins?: LDPlugin[];

  private _initialContext?: LDContext;

  // NOTE: This also keeps track of when we tried to initialize the client.
  private _startPromise?: Promise<LDWaitForInitializationResult>;

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
    const endpoints = browserFdv1Endpoints(clientSideId);

    const dataManagerFactory = (
      flagManager: FlagManager,
      configuration: Configuration,
      baseHeaders: LDHeaders,
      emitter: LDEmitter,
      diagnosticsManager?: internal.DiagnosticsManager,
    ) => {
      if (configuration.dataSystem) {
        return createFDv2DataManagerBase({
          platform,
          flagManager,
          credential: clientSideId,
          config: configuration,
          baseHeaders,
          emitter,
          transitionTable: BROWSER_TRANSITION_TABLE,
          foregroundMode: resolveForegroundMode(
            configuration.dataSystem,
            BROWSER_DATA_SYSTEM_DEFAULTS,
          ),
          backgroundMode: undefined,
          modeTable: MODE_TABLE,
          sourceFactoryProvider: createDefaultSourceFactoryProvider(),
          fdv1Endpoints: browserFdv1Endpoints(clientSideId),
          buildQueryParams: (identifyOptions?: LDBaseIdentifyOptions) => {
            const params: { key: string; value: string }[] = [{ key: 'auth', value: clientSideId }];
            const browserOpts = identifyOptions as LDIdentifyOptions | undefined;
            if (browserOpts?.hash) {
              params.push({ key: 'h', value: browserOpts.hash });
            }
            return params;
          },
        });
      }

      return new BrowserDataManager(
        platform,
        flagManager,
        clientSideId,
        configuration,
        validatedBrowserOptions,
        endpoints.polling,
        endpoints.streaming,
        baseHeaders,
        emitter,
        diagnosticsManager,
      );
    };

    super(clientSideId, autoEnvAttributes, platform, baseOptionsWithDefaults, dataManagerFactory, {
      // This logic is derived from https://github.com/launchdarkly/js-sdk-common/blob/main/src/PersistentFlagStore.js
      getLegacyStorageKeys: () =>
        getAllStorageKeys().filter((key) => key.startsWith(`ld:${clientSideId}:`)),
      analyticsEventPath: `/events/bulk/${clientSideId}`,
      diagnosticEventPath: `/events/diagnostic/${clientSideId}`,
      includeAuthorizationHeader: false,
      highTimeoutThreshold: 5,
      userAgentHeaderName: 'x-launchdarkly-user-agent',
      dataSystemDefaults: BROWSER_DATA_SYSTEM_DEFAULTS,
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
    });

    this.setEventSendingEnabled(true, false);

    // Forward the browser streaming option to the FDv2 data manager so that
    // an explicit streaming: false prevents auto-promotion to streaming.
    if (validatedBrowserOptions.streaming !== undefined) {
      this.dataManager.setForcedStreaming?.(validatedBrowserOptions.streaming);
    }

    this.dataManager.setFlushCallback?.(() => this.flush());

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

  override async identify(context: LDContext, identifyOptions?: LDIdentifyOptions): Promise<void> {
    return super.identify(context, identifyOptions);
  }

  override async identifyResult(
    context: LDContext,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<LDIdentifyResult> {
    if (!this._startPromise) {
      this.logger.error(
        'Client must be started before it can identify a context, did you forget to call start()?',
      );
      return { status: 'error', error: new Error('Identify called before start') };
    }

    const identifyOptionsWithUpdatedDefaults = {
      ...identifyOptions,
    };
    if (identifyOptions?.sheddable === undefined) {
      identifyOptionsWithUpdatedDefaults.sheddable = true;
    }

    const res = await super.identifyResult(context, identifyOptionsWithUpdatedDefaults);

    this._goalManager?.startTracking();
    return res;
  }

  start(options?: LDStartOptions): Promise<LDWaitForInitializationResult> {
    if (this.initializeResult) {
      return Promise.resolve(this.initializeResult);
    }
    if (this._startPromise) {
      return this._startPromise;
    }
    if (!this._initialContext) {
      this.logger.error('Initial context not set');
      return Promise.resolve({ status: 'failed', error: new Error('Initial context not set') });
    }

    // When we get to this point, we assume this is the first time that start is being
    // attempted. This line should only be called once during the lifetime of the client.
    const identifyOptions = {
      ...(options?.identifyOptions ?? {}),

      // Initial identify operations are not sheddable.
      sheddable: false,
    };

    // If the bootstrap data is provided in the start options, and the identify options do not have bootstrap data,
    // then use the bootstrap data from the start options.
    if (options?.bootstrap && !identifyOptions.bootstrap) {
      identifyOptions.bootstrap = options.bootstrap;
    }

    if (identifyOptions?.bootstrap) {
      try {
        if (!identifyOptions.bootstrapParsed) {
          identifyOptions.bootstrapParsed = readFlagsFromBootstrap(
            this.logger,
            identifyOptions.bootstrap,
          );
        }
        this.presetFlags(identifyOptions.bootstrapParsed!);
      } catch (error) {
        this.logger.error('Failed to bootstrap data', error);
      }
    }

    if (!this.initializedPromise) {
      this.initializedPromise = new Promise((resolve) => {
        this.initResolve = resolve;
      });
    }

    this._startPromise = this.promiseWithTimeout(this.initializedPromise!, options?.timeout ?? 5);

    this.identifyResult(this._initialContext!, identifyOptions);
    return this._startPromise;
  }

  setConnectionMode(mode?: FDv2ConnectionMode): void {
    if (!this.dataManager.setConnectionMode) {
      this.logger.warn(
        'setConnectionMode requires the FDv2 data system (dataSystem option). ' +
          'The call has no effect without it.',
      );
      return;
    }
    if (mode !== undefined && !(mode in MODE_TABLE)) {
      this.logger.warn(
        `setConnectionMode called with invalid mode '${mode}'. ` +
          `Valid modes: ${Object.keys(MODE_TABLE).join(', ')}.`,
      );
      return;
    }
    this.dataManager.setConnectionMode(mode);
  }

  setStreaming(streaming?: boolean): void {
    this.dataManager.setForcedStreaming?.(streaming);
  }

  private _updateAutomaticStreamingState() {
    const hasListeners = this.emitter
      .eventNames()
      .some((name) => name.startsWith('change:') || name === 'change');
    this.dataManager.setAutomaticStreamingState?.(hasListeners);
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
  initialContext: LDContext,
  autoEnvAttributes: AutoEnvAttributes,
  options: BrowserOptions = {},
  overridePlatform?: Platform,
): LDClient {
  const impl = new BrowserClientImpl(clientSideId, autoEnvAttributes, options, overridePlatform);
  impl.setInitialContext(initialContext);

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
    setConnectionMode: (mode?: FDv2ConnectionMode) => impl.setConnectionMode(mode),
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
    start: (startOptions?: LDStartOptions) => impl.start(startOptions),
  };

  impl.registerPlugins(client);

  return client;
}
