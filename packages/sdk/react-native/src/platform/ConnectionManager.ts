import { ConnectionMode, LDLogger } from '@launchdarkly/js-client-sdk-common';

export enum ApplicationState {
  /// The application is in the foreground.
  Foreground = 'foreground',

  /// The application is in the background.
  ///
  /// Note, the application will not be active while in the background, but
  /// it will track when it is entering or exiting a background state.
  Background = 'background',
}

export enum NetworkState {
  /// There is no network available for the SDK to use.
  Unavailable = 'unavailable',

  /// The network is available. Note that network requests may still fail
  /// for other reasons.
  Available = 'available',
}

export interface ConnectionDestination {
  setNetworkAvailability(available: boolean): void;
  setEventSendingEnabled(enabled: boolean, flush: boolean): void;
  setConnectionMode(mode: ConnectionMode): Promise<void>;
  flush(): Promise<void>;
}

export interface StateDetector {
  setApplicationStateListener(fn: (state: ApplicationState) => void): void;
  setNetworkStateListener(fn: (state: NetworkState) => void): void;

  stopListening(): void;
}

export interface ConnectionManagerConfig {
  /// The initial connection mode the SDK should use.
  readonly initialConnectionMode: ConnectionMode;

  /// Some platforms (windows, web, mac, linux) can continue executing code
  /// in the background.
  readonly runInBackground: boolean;

  /// Enable handling of network availability. When this is true the
  /// connection state will automatically change when network
  /// availability changes.
  readonly automaticNetworkHandling: boolean;

  /// Enable handling associated with transitioning between the foreground
  /// and background.
  readonly automaticBackgroundHandling: boolean;
}

export class ConnectionManager {
  private applicationState: ApplicationState = ApplicationState.Foreground;
  private networkState: NetworkState = NetworkState.Available;
  private offline: boolean = false;
  private currentConnectionMode: ConnectionMode;

  constructor(
    private readonly logger: LDLogger,
    private readonly config: ConnectionManagerConfig,
    private readonly destination: ConnectionDestination,
    private readonly detector: StateDetector,
  ) {
    this.currentConnectionMode = config.initialConnectionMode;
    if (config.automaticBackgroundHandling) {
      detector.setApplicationStateListener((state) => {
        this.applicationState = state;
        this.handleState();
      });
    }
    if (config.automaticNetworkHandling) {
      detector.setNetworkStateListener((state) => {
        this.networkState = state;
        this.handleState();
      });
    }
  }

  public setOffline(offline: boolean): void {
    this.offline = offline;
    this.handleState();
  }

  public setConnectionMode(mode: ConnectionMode) {
    this.currentConnectionMode = mode;
    this.handleState();
  }

  public close() {
    this.detector.stopListening();
  }

  private handleState(): void {
    this.logger.debug(`Handling state: ${this.applicationState}:${this.networkState}`);

    switch (this.networkState) {
      case NetworkState.Unavailable:
        this.destination.setNetworkAvailability(false);
        break;
      case NetworkState.Available:
        this.destination.setNetworkAvailability(true);
        switch (this.applicationState) {
          case ApplicationState.Foreground:
            this.setForegroundAvailable();
            break;
          case ApplicationState.Background:
            this.setBackgroundAvailable();
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }
  }

  private setForegroundAvailable(): void {
    if (this.offline) {
      this.destination.setConnectionMode('offline');
      this.destination.setEventSendingEnabled(false, false);
      return;
    }

    // Currently the foreground mode will always be whatever the last active
    // connection mode was.
    this.destination.setConnectionMode(this.currentConnectionMode);
    this.destination.setEventSendingEnabled(true, false);
  }

  private setBackgroundAvailable(): void {
    this.destination.flush();

    if (!this.config.runInBackground) {
      this.destination.setConnectionMode('offline');
      this.destination.setEventSendingEnabled(false, false);
      return;
    }

    // This SDK doesn't currently support automatic background polling.

    // If connections in the background are allowed, then use the same mode
    // as is configured for the foreground.
    this.setForegroundAvailable();
  }
}
