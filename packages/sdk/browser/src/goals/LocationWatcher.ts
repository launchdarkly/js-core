import { addWindowEventListener, getHref } from '../BrowserApi';

export const LOCATION_WATCHER_INTERVAL_MS = 300;

// Using any for the timer handle because the type is not the same for all
// platforms and we only need to use it opaquely.
export type IntervalHandle = any;

export interface LocationWatcher {
  close(): void;
}

/**
 * Creates a watcher for the browser URL that detects changes.
 *
 * This is used to detect URL changes for generating pageview events.
 *
 * @internal
 */
export function createLocationWatcher(callback: () => void): LocationWatcher {
  let previousLocation: string | undefined = getHref();

  const checkUrl = () => {
    const currentLocation = getHref();

    if (currentLocation !== previousLocation) {
      previousLocation = currentLocation;
      callback();
    }
  };

  /** The location is watched via polling and popstate events because it is possible to miss
   * navigation at certain points with just popstate. It is also to miss events with polling
   * because they can happen within the polling interval.
   * Details on when popstate is called:
   * https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event#when_popstate_is_sent
   */
  const watcherHandle = setInterval(checkUrl, LOCATION_WATCHER_INTERVAL_MS);

  const removeListener = addWindowEventListener('popstate', checkUrl);

  const cleanupListeners = () => {
    removeListener();
  };

  return {
    close() {
      if (watcherHandle) {
        clearInterval(watcherHandle);
      }
      cleanupListeners?.();
    },
  };
}
