import {
  AutoEnvAttributes,
  base64UrlEncode,
  BasicLogger,
  LDClient as CommonClient,
  Configuration,
  Encoding,
  FlagManager,
  internal,
  LDClientImpl,
  LDContext,
  LDEmitter,
  LDHeaders,
  Platform,
} from '@launchdarkly/js-client-sdk-common';

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
  setStreaming(streaming: boolean): void;
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
    const logger =
      customLogger ??
      new BasicLogger({
        level: debug ? 'debug' : 'info',
        // eslint-disable-next-line no-console
        destination: console.log,
      });

    // TODO: Use the already-configured baseUri from the SDK config. SDK-560
    const baseUrl = options.baseUri ?? 'https://clientsdk.launchdarkly.com';

    const platform = overridePlatform ?? new BrowserPlatform(logger);
<<<<<<< HEAD
    const validatedBrowserOptions = validateOptions(options, logger);
    const { eventUrlTransformer } = validatedBrowserOptions;
    super(
      clientSideId,
      autoEnvAttributes,
      platform,
      filterToBaseOptions(options),
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
=======
    const ValidatedBrowserOptions = validateOptions(options, logger);
    const { eventUrlTransformer } = ValidatedBrowserOptions;
    super(clientSideId, autoEnvAttributes, platform, filterToBaseOptions(options), {
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
    });
>>>>>>> origin/rlamb/fix-browser-contract-test-build

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

  override async identify(context: LDContext): Promise<void> {
    await super.identify(context);
    this.goalManager?.startTracking();
  }

  setStreaming(streaming: boolean): void {
    const browserDataManager = this.dataManager as BrowserDataManager;
    if (streaming) {
      browserDataManager.startDataSource();
    } else {
      browserDataManager.stopDataSource();
    }
  }

<<<<<<< HEAD
  // TODO: Setup event listeners.
=======
  override getPollingPaths(): DataSourcePaths {
    const parentThis = this;
    return {
      pathGet(encoding: Encoding, _plainContextString: string): string {
        return `/sdk/evalx/${parentThis.clientSideId}/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
      },
      pathReport(_encoding: Encoding, _plainContextString: string): string {
        return `/sdk/evalx/${parentThis.clientSideId}/context`;
      },
    };
  }

  override async identify(context: LDContext): Promise<void> {
    await super.identify(context);
    this.goalManager?.startTracking();
  }
>>>>>>> origin/rlamb/fix-browser-contract-test-build
}
