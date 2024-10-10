import { ConnectionMode, LDLogger } from '@launchdarkly/js-client-sdk-common';

/**
 * @internal
 */
export enum ApplicationState {
  /// The application is in the foreground.
  Foreground = 'foreground',

  /// The application is in the background.
  ///
  /// Note, the application will not be active while in the background, but
  /// it will track when it is entering or exiting a background state.
  Background = 'background',
}

/**
 * @internal
 */
export enum NetworkState {
  /// There is no network available for the SDK to use.
  Unavailable = 'unavailable',

  /// The network is available. Note that network requests may still fail
  /// for other reasons.
  Available = 'available',
}

/**
 * @internal
 */
export interface ConnectionDestination {
  setNetworkAvailability(available: boolean): void;
  setEventSendingEnabled(enabled: boolean, flush: boolean): void;
  setConnectionMode(mode: ConnectionMode): Promise<void>;
}

/**
 * @internal
 */
export interface StateDetector {
  setApplicationStateListener(fn: (state: ApplicationState) => void): void;
  setNetworkStateListener(fn: (state: NetworkState) => void): void;

  stopListening(): void;
}

/**
 * @internal
 */
export interface ConnectionManagerConfig {
  /// The initial connection mode the SDK should use.
  readonly initialConnectionMode: ConnectionMode;

  /**
   * Some platforms (windows, web, mac, linux) can continue executing code
   * in the background.
   */
  readonly runInBackground: boolean;

  /**
   * Enable handling of network availability. When this is true the
   * connection state will automatically change when network
   * availability changes.
   */
  readonly automaticNetworkHandling: boolean;

  /**
   * Enable handling associated with transitioning between the foreground
   * and background.
   */
  readonly automaticBackgroundHandling: boolean;
}

/**
 * @internal
 */
export class ConnectionManager {
  private _applicationState: ApplicationState = ApplicationState.Foreground;
  private _networkState: NetworkState = NetworkState.Available;
  private _offline: boolean = false;
  private _currentConnectionMode: ConnectionMode;

  constructor(
    private readonly _logger: LDLogger,
    private readonly _config: ConnectionManagerConfig,
    private readonly _destination: ConnectionDestination,
    private readonly _detector: StateDetector,
  ) {
    this._currentConnectionMode = _config.initialConnectionMode;
    if (_config.automaticBackgroundHandling) {
      _detector.setApplicationStateListener((state) => {
        this._applicationState = state;
        this._handleState();
      });
    }
    if (_config.automaticNetworkHandling) {
      _detector.setNetworkStateListener((state) => {
        this._networkState = state;
        this._handleState();
      });
    }
  }

  public setOffline(offline: boolean): void {
    this._offline = offline;
    this._handleState();
  }

  public setConnectionMode(mode: ConnectionMode) {
    this._currentConnectionMode = mode;
    this._handleState();
  }

  public close() {
    this._detector.stopListening();
  }

  private _handleState(): void {
    this._logger.debug(`Handling state: ${this._applicationState}:${this._networkState}`);

    switch (this._networkState) {
      case NetworkState.Unavailable:
        this._destination.setNetworkAvailability(false);
        break;
      case NetworkState.Available:
        this._destination.setNetworkAvailability(true);
        switch (this._applicationState) {
          case ApplicationState.Foreground:
            this._setForegroundAvailable();
            break;
          case ApplicationState.Background:
            this._setBackgroundAvailable();
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }
  }

  private _setForegroundAvailable(): void {
    if (this._offline) {
      this._destination.setConnectionMode('offline');
      // Don't attempt to flush. If the user wants to flush when entering offline
      // mode, then they can do that directly.
      this._destination.setEventSendingEnabled(false, false);
      return;
    }

    // Currently the foreground mode will always be whatever the last active
    // connection mode was.
    this._destination.setConnectionMode(this._currentConnectionMode);
    this._destination.setEventSendingEnabled(true, false);
  }

  private _setBackgroundAvailable(): void {
    if (!this._config.runInBackground) {
      this._destination.setConnectionMode('offline');
      this._destination.setEventSendingEnabled(false, true);
      return;
    }

    // This SDK doesn't currently support automatic background polling.

    // If connections in the background are allowed, then use the same mode
    // as is configured for the foreground.
    this._setForegroundAvailable();
  }
}
