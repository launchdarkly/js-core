import { AppState, AppStateStatus } from 'react-native';

import { ApplicationState, NetworkState, StateDetector } from './platform/ConnectionManager';

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

export default class RNStateDetector implements StateDetector {
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
