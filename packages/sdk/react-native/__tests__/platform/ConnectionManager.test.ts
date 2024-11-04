import { BasicLogger, ConnectionMode, LDLogger } from '@launchdarkly/js-client-sdk-common';

import {
  ApplicationState,
  ConnectionDestination,
  ConnectionManager,
  NetworkState,
  StateDetector,
} from '../../src/platform/ConnectionManager';

function mockDestination(): ConnectionDestination {
  return {
    setNetworkAvailability: jest.fn(),
    setEventSendingEnabled: jest.fn(),
    setConnectionMode: jest.fn(),
  };
}

class MockDetector implements StateDetector {
  appStateListener?: (state: ApplicationState) => void;
  networkStateListener?: (state: NetworkState) => void;

  setApplicationStateListener(fn: (state: ApplicationState) => void): void {
    this.appStateListener = fn;
  }
  setNetworkStateListener(fn: (state: NetworkState) => void): void {
    this.networkStateListener = fn;
  }
  stopListening(): void {
    this.appStateListener = undefined;
    this.networkStateListener = undefined;
  }
}

describe.each<ConnectionMode>(['streaming', 'polling'])(
  'given initial connection modes',
  (initialConnectionMode) => {
    let destination: ConnectionDestination;
    let stateDetector: MockDetector;
    let logDestination: jest.Mock;
    let logger: LDLogger;

    beforeEach(() => {
      destination = mockDestination();
      stateDetector = new MockDetector();
      logDestination = jest.fn();
      logger = new BasicLogger({ destination: logDestination });
    });

    it('can set the connection offline when entering the background', () => {
      // eslint-disable-next-line no-new
      new ConnectionManager(
        logger,
        {
          initialConnectionMode,
          runInBackground: false,
          automaticBackgroundHandling: true,
          automaticNetworkHandling: true,
        },
        destination,
        stateDetector,
      );
      stateDetector.appStateListener!(ApplicationState.Background);

      expect(destination.setConnectionMode).toHaveBeenCalledWith('offline');
    });

    it('can restore the connection when entering the foreground mode', () => {
      // eslint-disable-next-line no-new
      new ConnectionManager(
        logger,
        {
          initialConnectionMode,
          runInBackground: false,
          automaticBackgroundHandling: true,
          automaticNetworkHandling: true,
        },
        destination,
        stateDetector,
      );
      stateDetector.appStateListener!(ApplicationState.Background);
      stateDetector.appStateListener!(ApplicationState.Foreground);

      expect(destination.setConnectionMode).toHaveBeenNthCalledWith(1, 'offline');
      expect(destination.setConnectionMode).toHaveBeenNthCalledWith(2, initialConnectionMode);
      expect(destination.setConnectionMode).toHaveBeenCalledTimes(2);
    });

    it('can continue to run in the background when configured to do so', () => {
      // eslint-disable-next-line no-new
      new ConnectionManager(
        logger,
        {
          initialConnectionMode,
          runInBackground: true,
          automaticBackgroundHandling: true,
          automaticNetworkHandling: true,
        },
        destination,
        stateDetector,
      );
      stateDetector.appStateListener!(ApplicationState.Background);
      stateDetector.appStateListener!(ApplicationState.Foreground);
      expect(destination.setConnectionMode).toHaveBeenNthCalledWith(1, initialConnectionMode);
      expect(destination.setConnectionMode).toHaveBeenNthCalledWith(2, initialConnectionMode);
      expect(destination.setConnectionMode).toHaveBeenCalledTimes(2);
    });

    it('set the network availability to false when it detects the network is not available', () => {
      // eslint-disable-next-line no-new
      new ConnectionManager(
        logger,
        {
          initialConnectionMode,
          runInBackground: true,
          automaticBackgroundHandling: true,
          automaticNetworkHandling: true,
        },
        destination,
        stateDetector,
      );
      stateDetector.networkStateListener!(NetworkState.Unavailable);
      expect(destination.setNetworkAvailability).toHaveBeenCalledWith(false);
      expect(destination.setNetworkAvailability).toHaveBeenCalledTimes(1);
    });

    it('sets the network availability to true when it detects the network is available', () => {
      // eslint-disable-next-line no-new
      new ConnectionManager(
        logger,
        {
          initialConnectionMode,
          runInBackground: true,
          automaticBackgroundHandling: true,
          automaticNetworkHandling: true,
        },
        destination,
        stateDetector,
      );
      stateDetector.networkStateListener!(NetworkState.Unavailable);
      stateDetector.networkStateListener!(NetworkState.Available);
      expect(destination.setNetworkAvailability).toHaveBeenNthCalledWith(1, false);
      expect(destination.setNetworkAvailability).toHaveBeenNthCalledWith(2, true);
      expect(destination.setNetworkAvailability).toHaveBeenCalledTimes(2);
    });

    it('remains offline when temporarily offline', () => {
      // eslint-disable-next-line no-new
      const connectionManager = new ConnectionManager(
        logger,
        {
          initialConnectionMode,
          runInBackground: true,
          automaticBackgroundHandling: true,
          automaticNetworkHandling: true,
        },
        destination,
        stateDetector,
      );
      connectionManager.setOffline(true);

      stateDetector.appStateListener!(ApplicationState.Background);
      stateDetector.appStateListener!(ApplicationState.Foreground);

      expect(destination.setConnectionMode).toHaveBeenNthCalledWith(1, 'offline');
      expect(destination.setConnectionMode).toHaveBeenNthCalledWith(2, 'offline');
      expect(destination.setConnectionMode).toHaveBeenNthCalledWith(3, 'offline');
      expect(destination.setConnectionMode).toHaveBeenCalledTimes(3);
    });

    it('ignores application state changes when automaticBackgroundHandling is disabled', () => {
      // eslint-disable-next-line no-new
      new ConnectionManager(
        logger,
        {
          initialConnectionMode,
          runInBackground: true,
          automaticBackgroundHandling: false,
          automaticNetworkHandling: true,
        },
        destination,
        stateDetector,
      );
      stateDetector.appStateListener?.(ApplicationState.Background);
      stateDetector.appStateListener?.(ApplicationState.Foreground);

      expect(destination.setConnectionMode).toHaveBeenCalledTimes(0);
    });

    it('ignores network state changes when automaticNetworkHandling is disabled', () => {
      // eslint-disable-next-line no-new
      new ConnectionManager(
        logger,
        {
          initialConnectionMode,
          runInBackground: true,
          automaticBackgroundHandling: true,
          automaticNetworkHandling: false,
        },
        destination,
        stateDetector,
      );
      stateDetector.networkStateListener?.(NetworkState.Unavailable);
      stateDetector.networkStateListener?.(NetworkState.Available);
      expect(destination.setNetworkAvailability).toHaveBeenCalledTimes(0);
    });
  },
);

describe.each(['offline', 'streaming', 'polling'])('given requested connection modes', () => {
  it('respects changes to the desired connection mode', () => {});
});
