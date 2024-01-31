import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { debounce } from '@launchdarkly/js-client-sdk-common';

import ReactNativeLDClient from '../ReactNativeLDClient';

const useAppState = (client: ReactNativeLDClient) => {
  const appState = useRef(AppState.currentState);
  const onChange = (nextAppState: AppStateStatus) => {
    client.logger.debug(`App state prev ${appState.current}, next: ${nextAppState}`);

    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      client.logger.debug('App has come to the foreground.');

      if (client.isEventSourceClosed()) {
        client.logger.debug('Starting streamer after transitioning to foreground.');
        client.streamer?.start();
      } else {
        client.logger.debug('Not starting streamer because EventSource is already open.');
      }
    } else if (nextAppState === 'background') {
      client.logger.debug('App state background stopping streamer.');
      client.streamer?.stop();
    } else {
      client.logger.debug('No action needed.');
    }

    appState.current = nextAppState;
  };
  const debouncedOnChange = debounce(onChange, 5000);

  useEffect(() => {
    const sub = AppState.addEventListener('change', debouncedOnChange);

    return () => {
      sub.remove();
    };
  }, []);
};

export default useAppState;
