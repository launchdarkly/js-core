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
  internal,
  LDIdentifyOptions as LDBaseIdentifyOptions,
  LDClientImpl,
  LDContext,
  LDEmitter,
  LDEmitterEventName,
  LDHeaders,
  LDIdentifyResult,
  LDPluginEnvironmentMetadata,
  MODE_TABLE,
  Platform,
  resolveForegroundMode,
  safeRegisterDebugOverridePlugins,
} from '@launchdarkly/js-client-sdk-common';

import { getHref } from './BrowserApi';
import BrowserDataManager from './BrowserDataManager';
import { BrowserIdentifyOptions as LDIdentifyOptions } from './BrowserIdentifyOptions';
import { registerStateDetection } from './BrowserStateDetector';
import GoalManager from './goals/GoalManager';
import { Goal, isClick } from './goals/Goals';
import { LDClient } from './LDClient';
import { LDPlugin } from './LDPlugin';
import validateBrowserOptions, { BrowserOptions, filterToBaseOptionsWithDefaults } from './options';
import BrowserPlatform from './platform/BrowserPlatform';
import { getAllStorageKeys } from './platform/LocalStorage';

class BrowserClientImpl extends LDClientImpl {
  private readonly _goalManager?: GoalManager;
  private readonly _plugins?: LDPlugin[];

  constructor(
    clientSideId: string,
    initialContext: LDContext,
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
      requiresStart: true,
      initialContext,
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

  override async identify(
    context: LDContext,
    identifyOptions?: LDIdentifyOptions,
  ): Promise<LDIdentifyResult> {
    const options =
      identifyOptions?.sheddable === undefined
        ? { ...identifyOptions, sheddable: true }
        : identifyOptions;
    const res = await super.identify(context, options);
    // Ensure that we do not start the goal manager if start() is not called.
    if (this.startPromise) {
      this._goalManager?.startTracking();
    }
    return res;
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
  const client = new BrowserClientImpl(
    clientSideId,
    initialContext,
    autoEnvAttributes,
    options,
    overridePlatform,
  );

  client.registerPlugins(client);

  return client;
}
