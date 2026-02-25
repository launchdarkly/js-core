/* eslint-disable max-classes-per-file */
import {
  AutoEnvAttributes,
  BasicLogger,
  type Configuration,
  ConnectionMode,
  FlagManager,
  internal,
  LDClientImpl,
  LDClientInternalOptions,
  LDEmitter,
  LDHeaders,
  LDPluginEnvironmentMetadata,
  mobileFdv1Endpoints,
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

    const validatedRnOptions = validateOptions(options, logger);

    const internalOptions: LDClientInternalOptions = {
      analyticsEventPath: `/mobile`,
      diagnosticEventPath: `/mobile/events/diagnostic`,
      highTimeoutThreshold: 15,
      getImplementationHooks: (_environmentMetadata: LDPluginEnvironmentMetadata) =>
        internal.safeGetHooks(logger, _environmentMetadata, validatedRnOptions.plugins),
      credentialType: 'mobileKey',
    };

    const platform = createPlatform(logger, options, validatedRnOptions.storage);
    const endpoints = mobileFdv1Endpoints();

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
          endpoints.polling,
          endpoints.streaming,
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
    internal.safeRegisterPlugins(
      logger,
      this.environmentMetadata,
      this,
      validatedRnOptions.plugins,
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
