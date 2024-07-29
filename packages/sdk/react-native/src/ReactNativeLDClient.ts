/* eslint-disable max-classes-per-file */
import { AppState, AppStateStatus } from 'react-native';

import {
  AutoEnvAttributes,
  base64UrlEncode,
  BasicLogger,
  ConnectionMode,
  internal,
  LDClientImpl,
  type LDContext,
  type LDOptions,
} from '@launchdarkly/js-client-sdk-common';

import createPlatform from './platform';
import {
  ApplicationState,
  ConnectionDestination,
  ConnectionManager,
  NetworkState,
  StateDetector,
} from './platform/ConnectionManager';

function translateAppState(state: AppStateStatus): ApplicationState {
  switch (state) {
    case 'active':
      return ApplicationState.Foreground;
    case 'inactive':
    case 'background':
    case 'extension':
    default:
      return ApplicationState.Background;
  }
}

class RNStateDetector implements StateDetector {
  private applicationStateListener?: (state: ApplicationState) => void;
  private networkStateListener?: (state: NetworkState) => void;

  constructor() {
    AppState.addEventListener('change', (state: AppStateStatus) => {
      this.applicationStateListener?.(translateAppState(state));
    });
  }

  setApplicationStateListener(fn: (state: ApplicationState) => void): void {
    this.applicationStateListener = fn;
    // When you listen provide the current state immediately.
    this.applicationStateListener(translateAppState(AppState.currentState));
  }
  setNetworkStateListener(fn: (state: NetworkState) => void): void {
    this.networkStateListener = fn;
  }
  stopListening(): void {
    this.applicationStateListener = undefined;
    this.networkStateListener = undefined;
  }
}

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
        super.setConnectionMode(mode);
      },
      flush: async () => {
        this.flush();
      },
    };

    const initialConnectionMode = options.initialConnectionMode ?? 'streaming';
    this.connectionManager = new ConnectionManager(
      logger,
      {
        initialConnectionMode,
        automaticNetworkHandling: true,
        automaticBackgroundHandling: true,
        runInBackground: false,
      },
      destination,
      new RNStateDetector(),
    );
  }

  override createStreamUriPath(context: LDContext) {
    return `/meval/${base64UrlEncode(JSON.stringify(context), this.platform.encoding!)}`;
  }

  override async setConnectionMode(mode: ConnectionMode): Promise<void> {
    // Set the connection mode before setting offline, in case there is any mode transition work
    // such as flushing on entering the background.
    this.connectionManager.setConnectionMode(mode);
    // For now the data source connection and the event processing state are connected.
    this.connectionManager.setOffline(mode === 'offline');
  }
}
