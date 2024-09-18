import {
  AutoEnvAttributes,
  base64UrlEncode,
  BasicLogger,
  LDClient as CommonClient,
  Context,
  internal,
  LDClientImpl,
  LDContext,
} from '@launchdarkly/js-client-sdk-common';

import GoalManager from './goals/GoalManager';
import { Goal, isClick } from './goals/Goals';
import validateOptions, { BrowserOptions, filterToBaseOptions } from './options';
import BrowserPlatform from './platform/BrowserPlatform';

/**
 * We are not supporting dynamically setting the connection mode on the LDClient.
 */
export type LDClient = Omit<CommonClient, 'setConnectionMode'>;

export class BrowserClient extends LDClientImpl {
  private readonly goalManager?: GoalManager;
  constructor(
    private readonly clientSideId: string,
    autoEnvAttributes: AutoEnvAttributes,
    options: BrowserOptions = {},
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

    const platform = new BrowserPlatform(options);
    const ValidatedBrowserOptions = validateOptions(options, logger);
    super(clientSideId, autoEnvAttributes, platform, filterToBaseOptions(options), {
      analyticsEventPath: `/events/bulk/${clientSideId}`,
      diagnosticEventPath: `/events/diagnostic/${clientSideId}`,
      includeAuthorizationHeader: false,
      highTimeoutThreshold: 5,
      userAgentHeaderName: 'x-launchdarkly-user-agent',
    });

    if (ValidatedBrowserOptions.fetchGoals) {
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
          if (isClick(goal)) {
            this.sendEvent({
              kind: 'click',
              url,
              samplingRatio: 1,
              key: goal.key,
              creationDate: Date.now(),
              context,
              selector: goal.selector,
            });
          } else {
            this.sendEvent({
              kind: 'pageview',
              url,
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

  private encodeContext(context: LDContext) {
    return base64UrlEncode(JSON.stringify(context), this.platform.encoding!);
  }

  override createStreamUriPath(context: LDContext) {
    return `/eval/${this.clientSideId}/${this.encodeContext(context)}`;
  }

  override createPollUriPath(context: LDContext): string {
    return `/sdk/evalx/${this.clientSideId}/contexts/${this.encodeContext(context)}`;
  }
}
