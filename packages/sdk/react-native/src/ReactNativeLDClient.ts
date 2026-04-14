/* eslint-disable max-classes-per-file */
import {
  AutoEnvAttributes,
  BasicLogger,
  type Configuration,
  ConnectionMode,
  createDefaultSourceFactoryProvider,
  createFDv2DataManagerBase,
  FDv2ConnectionMode,
  type FDv2DataManagerControl,
  FlagManager,
  internal,
  type LDClientDataSystemOptions,
  LDClientImpl,
  LDClientInternalOptions,
  LDEmitter,
  LDHeaders,
  LDPluginEnvironmentMetadata,
  MOBILE_DATA_SYSTEM_DEFAULTS,
  MOBILE_TRANSITION_TABLE,
  mobileFdv1Endpoints,
  MODE_TABLE,
  resolveForegroundMode,
} from '@launchdarkly/js-client-sdk-common';

import MobileDataManager from './MobileDataManager';
import validateOptions, { filterToBaseOptions } from './options';
import createPlatform from './platform';
import {
  ApplicationState,
  ConnectionDestination,
  ConnectionManager,
  NetworkState,
} from './platform/ConnectionManager';
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
function shouldAutoSwitchLifecycle(
  config: LDClientDataSystemOptions['automaticModeSwitching'],
): boolean {
  if (config === true) {
    return true;
  }
  if (typeof config === 'object' && config.type === 'automatic') {
    return config.lifecycle ?? true;
  }
  return false;
}

function shouldAutoSwitchNetwork(
  config: LDClientDataSystemOptions['automaticModeSwitching'],
): boolean {
  if (config === true) {
    return true;
  }
  if (typeof config === 'object' && config.type === 'automatic') {
    return config.network ?? true;
  }
  return false;
}

export default class ReactNativeLDClient extends LDClientImpl {
  private _connectionManager?: ConnectionManager;
  private _stateDetector?: RNStateDetector;

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
      dataSystemDefaults: MOBILE_DATA_SYSTEM_DEFAULTS,
    };

    const platform = createPlatform(logger, options, validatedRnOptions.storage);
    const endpoints = mobileFdv1Endpoints();

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
          credential: sdkKey,
          config: configuration,
          baseHeaders,
          emitter,
          transitionTable: MOBILE_TRANSITION_TABLE,
          foregroundMode: resolveForegroundMode(
            configuration.dataSystem,
            MOBILE_DATA_SYSTEM_DEFAULTS,
          ),
          backgroundMode: configuration.dataSystem.backgroundConnectionMode ?? 'background',
          modeTable: MODE_TABLE,
          sourceFactoryProvider: createDefaultSourceFactoryProvider(),
          fdv1Endpoints: mobileFdv1Endpoints(),
          buildQueryParams: () => [], // Mobile uses Authorization header, not query params
        });
      }

      return new MobileDataManager(
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
      );
    };

    super(
      sdkKey,
      autoEnvAttributes,
      platform,
      { ...filterToBaseOptions(options), logger },
      dataManagerFactory,
      internalOptions,
    );

    if (this.isFDv2) {
      const fdv2DataManager = this.dataManager as FDv2DataManagerControl;

      this.setEventSendingEnabled(true, false);
      fdv2DataManager.setFlushCallback(() => this.flush());

      // Wire state detection directly to FDv2 data manager using the
      // validated automaticModeSwitching config from the data system.
      const { automaticModeSwitching } = this.dataSystemConfig ?? {};
      const stateDetector = new RNStateDetector();
      this._stateDetector = stateDetector;

      if (shouldAutoSwitchLifecycle(automaticModeSwitching)) {
        stateDetector.setApplicationStateListener((state) => {
          fdv2DataManager.setLifecycleState(
            state === ApplicationState.Foreground ? 'foreground' : 'background',
          );
        });
      }

      if (shouldAutoSwitchNetwork(automaticModeSwitching)) {
        stateDetector.setNetworkStateListener((state) => {
          fdv2DataManager.setNetworkState(
            state === NetworkState.Available ? 'available' : 'unavailable',
          );
        });
      }
    } else {
      const initialConnectionMode = options.initialConnectionMode ?? 'streaming';
      this.setEventSendingEnabled(initialConnectionMode !== 'offline', false);

      const dataManager = this.dataManager as MobileDataManager;
      const destination: ConnectionDestination = {
        setNetworkAvailability: (available: boolean) => {
          dataManager.setNetworkAvailability(available);
        },
        setEventSendingEnabled: (enabled: boolean, flush: boolean) => {
          this.setEventSendingEnabled(enabled, flush);
        },
        setConnectionMode: async (mode: ConnectionMode) => {
          dataManager.setConnectionMode(mode);
        },
      };

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

    internal.safeRegisterPlugins(
      logger,
      this.environmentMetadata,
      this,
      validatedRnOptions.plugins,
    );
  }

  override async close(): Promise<void> {
    this._stateDetector?.stopListening();
    this._connectionManager?.close();
    return super.close();
  }


  /**
   * Sets the SDK connection mode.
   *
   * @param mode The connection mode to use (`'streaming'`, `'polling'`, or `'offline'`).
   */
  async setConnectionMode(mode: ConnectionMode): Promise<void>;
  /**
   * @internal
   *
   * This overload is experimental and should NOT be considered ready for
   * production use. It may change or be removed without notice and is not
   * subject to backwards compatibility guarantees.
   *
   * Sets the connection mode for the FDv2 data system.
   *
   * When the FDv2 data system is enabled (`dataSystem` option), this method
   * additionally accepts `'one-shot'` and `'background'` modes. Pass
   * `undefined` to clear an explicit override and return to automatic mode
   * selection.
   *
   * @param mode The connection mode to use, or `undefined` to clear the
   *   override (FDv2 only).
   */
  async setConnectionMode(mode?: FDv2ConnectionMode): Promise<void>;
  async setConnectionMode(mode?: ConnectionMode | FDv2ConnectionMode): Promise<void> {
    if (this.isFDv2) {
      // FDv2 path
      if (mode !== undefined && !(mode in MODE_TABLE)) {
        this.logger.warn(
          `setConnectionMode called with invalid mode '${mode}'. ` +
            `Valid modes: ${Object.keys(MODE_TABLE).join(', ')}.`,
        );
        return;
      }
      (this.dataManager as FDv2DataManagerControl).setConnectionMode(
        mode as FDv2ConnectionMode | undefined,
      );
    } else {
      // FDv1 path
      if (mode === undefined || mode === 'one-shot' || mode === 'background') {
        this.logger.warn(
          `setConnectionMode('${mode}') is only supported with the FDv2 data system (dataSystem option).`,
        );
        return;
      }
      this._connectionManager?.setConnectionMode(mode as ConnectionMode);
      this._connectionManager?.setOffline(mode === 'offline');
    }
  }

  /**
   * Gets the SDK connection mode.
   */
  getConnectionMode(): ConnectionMode;
  /**
   * @internal
   */
  getConnectionMode(): FDv2ConnectionMode;
  getConnectionMode(): ConnectionMode | FDv2ConnectionMode {
    if (this.isFDv2) {
      return (this.dataManager as FDv2DataManagerControl).getCurrentMode();
    }
    return (this.dataManager as MobileDataManager).getConnectionMode();
  }

  isOffline() {
    if (this.isFDv2) {
      return (this.dataManager as FDv2DataManagerControl).getCurrentMode() === 'offline';
    }
    return (this.dataManager as MobileDataManager).getConnectionMode() === 'offline';
  }
}
