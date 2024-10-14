import { AppState, AppStateStatus } from 'react-native';

import { ApplicationState, NetworkState, StateDetector } from './platform/ConnectionManager';

/**
 * @internal
 */
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

/**
 * @internal
 */
export default class RNStateDetector implements StateDetector {
  private _applicationStateListener?: (state: ApplicationState) => void;
  private _networkStateListener?: (state: NetworkState) => void;

  constructor() {
    AppState.addEventListener('change', (state: AppStateStatus) => {
      this._applicationStateListener?.(translateAppState(state));
    });
  }

  setApplicationStateListener(fn: (state: ApplicationState) => void): void {
    this._applicationStateListener = fn;
    // When you listen provide the current state immediately.
    this._applicationStateListener(translateAppState(AppState.currentState));
  }

  setNetworkStateListener(fn: (state: NetworkState) => void): void {
    this._networkStateListener = fn;
    // Not implemented.
  }

  stopListening(): void {
    this._applicationStateListener = undefined;
    this._networkStateListener = undefined;
  }
}
