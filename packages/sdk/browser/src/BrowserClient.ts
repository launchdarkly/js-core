import {
  AutoEnvAttributes,
  base64UrlEncode,
  LDClient as CommonClient,
  Configuration,
  createSafeLogger,
  Encoding,
  FlagManager,
  internal,
  LDClientImpl,
  LDContext,
  LDEmitter,
  LDHeaders,
  Platform,
} from '@launchdarkly/js-client-sdk-common';
import { LDIdentifyOptions } from '@launchdarkly/js-client-sdk-common/dist/api/LDIdentifyOptions';
import { EventName } from '@launchdarkly/js-client-sdk-common/dist/LDEmitter';

import BrowserDataManager from './BrowserDataManager';
import GoalManager from './goals/GoalManager';
import { Goal, isClick } from './goals/Goals';
import validateOptions, { BrowserOptions, filterToBaseOptions } from './options';
import BrowserPlatform from './platform/BrowserPlatform';

/**
 * We are not supporting dynamically setting the connection mode on the LDClient.
 * The SDK does not support offline mode. Instead bootstrap data can be used.
 */
export type LDClient = Omit<
  CommonClient,
  'setConnectionMode' | 'getConnectionMode' | 'getOffline'
> & {
  /**
   * Specifies whether or not to open a streaming connection to LaunchDarkly for live flag updates.
   *
   * If this is true, the client will always attempt to maintain a streaming connection; if false,
   * it never will. If you leave the value undefined (the default), the client will open a streaming
   * connection if you subscribe to `"change"` or `"change:flag-key"` events (see {@link LDClient.on}).
   *
   * This can also be set as the `streaming` property of {@link LDOptions}.
   */
  setStreaming(streaming?: boolean): void;
};

export class BrowserClient extends LDClientImpl {
  private readonly goalManager?: GoalManager;

  constructor(
    private readonly clientSideId: string,
    autoEnvAttributes: AutoEnvAttributes,
    options: BrowserOptions = {},
    overridePlatform?: Platform,
  ) {
    const { logger: customLogger, debug } = options;
    // Overrides the default logger from the common implementation.
    const logger =
      customLogger ??
      createSafeLogger({
        // eslint-disable-next-line no-console
        debug: debug ? console.debug : () => {},
        // eslint-disable-next-line no-console
        info: console.info,
        // eslint-disable-next-line no-console
        warn: console.warn,
        // eslint-disable-next-line no-console
        error: console.error,
      });

    // TODO: Use the already-configured baseUri from the SDK config. SDK-560
    const baseUrl = options.baseUri ?? 'https://clientsdk.launchdarkly.com';

    const platform = overridePlatform ?? new BrowserPlatform(logger);
    const validatedBrowserOptions = validateOptions(options, logger);
    const { eventUrlTransformer } = validatedBrowserOptions;
    super(
      clientSideId,
      autoEnvAttributes,
      platform,
      filterToBaseOptions({ ...options, logger }),
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
          }),
          () => ({
            pathGet(encoding: Encoding, _plainContextString: string): string {
              return `/eval/${clientSideId}/${base64UrlEncode(_plainContextString, encoding)}`;
            },
            pathReport(_encoding: Encoding, _plainContextString: string): string {
              return `/eval/${clientSideId}`;
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
            eventUrlTransformer(window.location.href),
          ),
      },
    );

    this.setEventSendingEnabled(true, false);

    if (validatedBrowserOptions.fetchGoals) {
      this.goalManager = new GoalManager(
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
      this.goalManager.initialize();
    }
  }

  override async identify(context: LDContext, identifyOptions?: LDIdentifyOptions): Promise<void> {
    await super.identify(context, identifyOptions);
    this.goalManager?.startTracking();
  }

  setStreaming(streaming?: boolean): void {
    // With FDv2 we may want to consider if we support connection mode directly.
    // Maybe with an extension to connection mode for 'automatic'.
    const browserDataManager = this.dataManager as BrowserDataManager;
    browserDataManager.setForcedStreaming(streaming);
  }

  private updateAutomaticStreamingState() {
    const browserDataManager = this.dataManager as BrowserDataManager;
    // This will need changed if support for listening to individual flag change
    // events it added.
    browserDataManager.setAutomaticStreamingState(!!this.emitter.listenerCount('change'));
  }

  override on(eventName: EventName, listener: Function): void {
    super.on(eventName, listener);
    this.updateAutomaticStreamingState();
  }

  override off(eventName: EventName, listener: Function): void {
    super.off(eventName, listener);
    this.updateAutomaticStreamingState();
  }
}
