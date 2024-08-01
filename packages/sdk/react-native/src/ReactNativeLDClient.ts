/* eslint-disable max-classes-per-file */
import {
  AutoEnvAttributes,
  base64UrlEncode,
  BasicLogger,
  ConnectionMode,
  internal,
  LDClientImpl,
  type LDContext,
} from '@launchdarkly/js-client-sdk-common';

import createPlatform from './platform';
import { ConnectionDestination, ConnectionManager } from './platform/ConnectionManager';
import LDOptions from './RNOptions';
import RNStateDetector from './RNStateDetector';

/**
 * The React Native LaunchDarkly client. Instantiate this class to create an
 * instance of the ReactNativeLDClient and pass it to the {@link LDProvider}.
 *
 * @example
 * ```tsx
 * const featureClient = new ReactNativeLDClient(MOBILE_KEY, AutoEnvAttributes.Enabled);
 *
 * <LDProvider client={featureClient}>
 *   <Welcome />
 * </LDProvider>
 * ```
 */
export default class ReactNativeLDClient extends LDClientImpl {
  private connectionManager: ConnectionManager;
  /**
   * Creates an instance of the LaunchDarkly client.
   *
   * @param sdkKey The LaunchDarkly mobile key.
   * @param autoEnvAttributes Enable / disable Auto environment attributes. When enabled, the SDK will automatically
   * provide data about the mobile environment where the application is running. To learn more,
   * read [Automatic environment attributes](https://docs.launchdarkly.com/sdk/features/environment-attributes).
   * for more documentation.
   * @param options {@link LDOptions} to initialize the client with.
   */
  constructor(sdkKey: string, autoEnvAttributes: AutoEnvAttributes, options: LDOptions = {}) {
    const { logger: customLogger, debug } = options;
    const logger =
      customLogger ??
      new BasicLogger({
        level: debug ? 'debug' : 'info',
        // eslint-disable-next-line no-console
        destination: console.log,
      });

    const internalOptions: internal.LDInternalOptions = {
      analyticsEventPath: `/mobile`,
      diagnosticEventPath: `/mobile/events/diagnostic`,
      highTimeoutThreshold: 15,
    };

    super(
      sdkKey,
      autoEnvAttributes,
      createPlatform(logger),
      { ...options, logger },
      internalOptions,
    );

    const destination: ConnectionDestination = {
      setNetworkAvailability: (available: boolean) => {
        this.setNetworkAvailability(available);
      },
      setEventSendingEnabled: (enabled: boolean, flush: boolean) => {
        this.setEventSendingEnabled(enabled, flush);
      },
      setConnectionMode: async (mode: ConnectionMode) => {
        // Pass the connection mode to the base implementation.
        // The RN implementation will pass the connection mode through the connection manager.
        this.baseSetConnectionMode(mode);
      },
    };

    const initialConnectionMode = options.initialConnectionMode ?? 'streaming';
    this.connectionManager = new ConnectionManager(
      logger,
      {
        initialConnectionMode,
        // TODO: Add the ability to configure connection management.
        // This is not yet added as the RN SDK needs package specific configuration added.
        // TODO: Add RN config option validation beyond base options.
        automaticNetworkHandling: options.automaticNetworkHandling ?? true,
        automaticBackgroundHandling: options.automaticBackgroundHandling ?? true,
        runInBackground: options.runInBackground ?? true,
      },
      destination,
      new RNStateDetector(),
    );
  }

  private baseSetConnectionMode(mode: ConnectionMode) {
    // Jest had problems with calls to super from nested arrow functions, so this method proxies the call.
    super.setConnectionMode(mode);
  }

  private encodeContext(context: LDContext) {
    return base64UrlEncode(JSON.stringify(context), this.platform.encoding!);
  }

  override createStreamUriPath(context: LDContext) {
    return `/meval/${this.encodeContext(context)}`;
  }

  override createPollUriPath(context: LDContext): string {
    return `/msdk/evalx/contexts/${this.encodeContext(context)}`;
  }

  override async setConnectionMode(mode: ConnectionMode): Promise<void> {
    // Set the connection mode before setting offline, in case there is any mode transition work
    // such as flushing on entering the background.
    this.connectionManager.setConnectionMode(mode);
    // For now the data source connection and the event processing state are connected.
    this.connectionManager.setOffline(mode === 'offline');
  }
}
