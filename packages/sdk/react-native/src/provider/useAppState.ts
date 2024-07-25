import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { debounce } from '@launchdarkly/js-client-sdk-common';

import { PlatformRequests } from '../platform';
import ReactNativeLDClient from '../ReactNativeLDClient';

/**
 * Manages streamer connection based on AppState. Debouncing is used to prevent excessive starting
 * and stopping of the EventSource which are expensive.
 *
 * background to active - start streamer.
 * active to background - stop streamer.
 *
 * @param client
 */
const useAppState = (client: ReactNativeLDClient) => {
  const appState = useRef(AppState.currentState);

  const isEventSourceClosed = () => {
    const { eventSource } = client.platform.requests as PlatformRequests;
    return eventSource?.getStatus() === eventSource?.CLOSED;
  };

  const onChange = (nextAppState: AppStateStatus) => {
    client.logger.debug(`App state prev: ${appState.current}, next: ${nextAppState}`);

    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      if (isEventSourceClosed()) {
        client.logger.debug('Starting streamer after transitioning to foreground.');
        client.updateProcessor?.start();
      } else {
        client.logger.debug('Not starting streamer because EventSource is already open.');
      }
    } else if (nextAppState === 'background') {
      client.logger.debug('App state background stopping streamer.');
      client.updateProcessor?.stop();
    } else {
      client.logger.debug('No action needed.');
    }

    appState.current = nextAppState;
  };

  // debounce with a default delay of 5 seconds.
  const debouncedOnChange = debounce(onChange);

  useEffect(() => {
    const sub = AppState.addEventListener('change', debouncedOnChange);

    return () => {
      sub.remove();
    };
  }, []);
};

export default useAppState;
