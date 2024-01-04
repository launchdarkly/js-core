import {
  base64UrlEncode,
  BasicLogger,
  internal,
  LDClientImpl,
  type LDContext,
  type LDOptions,
} from '@launchdarkly/js-client-sdk-common';

import createAutoEnv from './createAutoEnv';
import createPlatform from './platform';

/**
 * The React Native LaunchDarkly client. Instantiate this class to create an
 * instance of the ReactNativeLDClient and pass it to the {@link LDProvider}.
 *
 * @example
 * ```tsx
 * const featureClient = new ReactNativeLDClient(MOBILE_KEY);
 *
 * <LDProvider client={featureClient}>
 *   <Welcome />
 * </LDProvider>
 * ```
 */
export default class ReactNativeLDClient extends LDClientImpl {
  /**
   * Creates an instance of the LaunchDarkly client.
   *
   * @param sdkKey The LaunchDarkly mobile key.
   * @param options {@link LDOptions} to initialize the client with.
   */
  constructor(sdkKey: string, options: LDOptions = {}) {
    const logger =
      options.logger ??
      new BasicLogger({
        level: 'debug',
        // eslint-disable-next-line no-console
        destination: console.log,
      });

    const internalOptions: internal.LDInternalOptions = {
      analyticsEventPath: `/mobile`,
      diagnosticEventPath: `/mobile/events/diagnostic`,
      autoEnv: createAutoEnv(),
    };

    super(sdkKey, createPlatform(logger), { ...options, logger }, internalOptions);
  }

  override createStreamUriPath(context: LDContext) {
    return `/meval/${base64UrlEncode(JSON.stringify(context), this.platform.encoding!)}`;
  }
}
