import {
  AutoEnvAttributes,
  base64UrlEncode,
  BasicLogger,
  Configuration,
  Encoding,
  FlagManager,
  internal,
  LDClientImpl,
  LDContext,
  LDEmitter,
  LDEmitterEventName,
  LDHeaders,
  LDPluginEnvironmentMetadata,
  Platform,
} from '@launchdarkly/js-client-sdk-common';

import { getHref } from './BrowserApi';
import BrowserDataManagerV2 from './BrowserDataManagerV2';
import { BrowserIdentifyOptions as LDIdentifyOptions } from './BrowserIdentifyOptions';
import { registerStateDetection } from './BrowserStateDetector';
import GoalManager from './goals/GoalManager';
import { Goal, isClick } from './goals/Goals';
import { LDClient } from './LDClient';
import validateBrowserOptions, { BrowserOptions, filterToBaseOptionsWithDefaults } from './options';
import BrowserPlatform from './platform/BrowserPlatform';

export class BrowserClientV2 extends LDClientImpl implements LDClient {
  private readonly _goalManager?: GoalManager;

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
        new BrowserDataManagerV2(
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
              // TODO: double check these paths once FD team has updated their endpoints
              return `/sdk/stream/eval/${clientSideId}/${base64UrlEncode(_plainContextString, encoding)}`;
            },
            pathReport(_encoding: Encoding, _plainContextString: string): string {
              // TODO: double check these paths once FD team has updated their endpoints
              return `/sdk/stream/eval/${clientSideId}`;
            },
            pathPing(_encoding: Encoding, _plainContextString: string): string {
              // TODO: verify ping path is staying the same, seems like it would since it transfers no data
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
    internal.safeRegisterPlugins(
      logger,
      this.environmentMetadata,
      this,
      validatedBrowserOptions.plugins,
    );
  }

  override async identify(context: LDContext, identifyOptions?: LDIdentifyOptions): Promise<void> {
    await super.identify(context, identifyOptions);
    this._goalManager?.startTracking();
  }

  setStreaming(streaming?: boolean): void {
    // With FDv2 we may want to consider if we support connection mode directly.
    // Maybe with an extension to connection mode for 'automatic'.
    const browserDataManager = this.dataManager as BrowserDataManagerV2;
    browserDataManager.setForcedStreaming(streaming);
  }

  private _updateAutomaticStreamingState() {
    const browserDataManager = this.dataManager as BrowserDataManagerV2;
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
