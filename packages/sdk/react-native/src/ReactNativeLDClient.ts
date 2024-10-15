/* eslint-disable max-classes-per-file */
import {
  AutoEnvAttributes,
  base64UrlEncode,
  BasicLogger,
  type Configuration,
  ConnectionMode,
  Encoding,
  FlagManager,
  internal,
  LDClientImpl,
  LDEmitter,
  LDHeaders,
} from '@launchdarkly/js-client-sdk-common';

import MobileDataManager from './MobileDataManager';
import validateOptions, { filterToBaseOptions } from './options';
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
  private _connectionManager: ConnectionManager;
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

    const validatedRnOptions = validateOptions(options, logger);
    const platform = createPlatform(logger, validatedRnOptions.storage);

    super(
      sdkKey,
      autoEnvAttributes,
      platform,
      { ...filterToBaseOptions(options), logger },
      (
        flagManager: FlagManager,
        configuration: Configuration,
        baseHeaders: LDHeaders,
        emitter: LDEmitter,
        diagnosticsManager?: internal.DiagnosticsManager,
      ) =>
        new MobileDataManager(
          platform,
          flagManager,
          sdkKey,
          configuration,
          validatedRnOptions,
          () => ({
            pathGet(encoding: Encoding, _plainContextString: string): string {
              return `/msdk/evalx/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
            },
            pathReport(_encoding: Encoding, _plainContextString: string): string {
              return `/msdk/evalx/context`;
            },
            pathPing(_encoding: Encoding, _plainContextString: string): string {
              // Note: if you are seeing this error, it is a coding error. This DataSourcePaths implementation is for polling endpoints. /ping is not currently
              // used in a polling situation. It is probably the case that this was called by streaming logic erroneously.
              throw new Error('Ping for polling unsupported.');
            },
          }),
          () => ({
            pathGet(encoding: Encoding, _plainContextString: string): string {
              return `/meval/${base64UrlEncode(_plainContextString, encoding)}`;
            },
            pathReport(_encoding: Encoding, _plainContextString: string): string {
              return `/meval`;
            },
            pathPing(_encoding: Encoding, _plainContextString: string): string {
              return `/mping`;
            },
          }),
          baseHeaders,
          emitter,
          diagnosticsManager,
        ),
      internalOptions,
    );

    this.setEventSendingEnabled(!this.isOffline(), false);

    const dataManager = this.dataManager as MobileDataManager;
    const destination: ConnectionDestination = {
      setNetworkAvailability: (available: boolean) => {
        dataManager.setNetworkAvailability(available);
      },
      setEventSendingEnabled: (enabled: boolean, flush: boolean) => {
        this.setEventSendingEnabled(enabled, flush);
      },
      setConnectionMode: async (mode: ConnectionMode) => {
        // Pass the connection mode to the base implementation.
        // The RN implementation will pass the connection mode through the connection manager.
        dataManager.setConnectionMode(mode);
      },
    };

    const initialConnectionMode = options.initialConnectionMode ?? 'streaming';
    this._connectionManager = new ConnectionManager(
      logger,
      {
        initialConnectionMode,
        automaticNetworkHandling: validatedRnOptions.automaticNetworkHandling,
        automaticBackgroundHandling: validatedRnOptions.automaticBackgroundHandling,
        runInBackground: validatedRnOptions.runInBackground,
      },
      destination,
      new RNStateDetector(),
    );
  }

  async setConnectionMode(mode: ConnectionMode): Promise<void> {
    // Set the connection mode before setting offline, in case there is any mode transition work
    // such as flushing on entering the background.
    this._connectionManager.setConnectionMode(mode);
    // For now the data source connection and the event processing state are connected.
    this._connectionManager.setOffline(mode === 'offline');
  }

  /**
   * Gets the SDK connection mode.
   */
  getConnectionMode(): ConnectionMode {
    const dataManager = this.dataManager as MobileDataManager;
    return dataManager.getConnectionMode();
  }

  isOffline() {
    const dataManager = this.dataManager as MobileDataManager;
    return dataManager.getConnectionMode() === 'offline';
  }
}
