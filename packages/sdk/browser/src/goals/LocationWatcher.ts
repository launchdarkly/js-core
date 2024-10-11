import { addWindowEventListener, getHref } from '../BrowserApi';

export const LOCATION_WATCHER_INTERVAL_MS = 300;

// Using any for the timer handle because the type is not the same for all
// platforms and we only need to use it opaquely.
export type IntervalHandle = any;

export interface LocationWatcher {
  close(): void;
}

/**
 * Watches the browser URL and detects changes.
 *
 * This is used to detect URL changes for generating pageview events.
 *
 * @internal
 */
export class DefaultLocationWatcher {
  private _previousLocation?: string;
  private _watcherHandle: IntervalHandle;
  private _cleanupListeners?: () => void;

  /**
   * @param callback Callback that is executed whenever a URL change is detected.
   */
  constructor(callback: () => void) {
    this._previousLocation = getHref();
    const checkUrl = () => {
      const currentLocation = getHref();

      if (currentLocation !== this._previousLocation) {
        this._previousLocation = currentLocation;
        callback();
      }
    };
    /** The location is watched via polling and popstate events because it is possible to miss
     * navigation at certain points with just popstate. It is also to miss events with polling
     * because they can happen within the polling interval.
     * Details on when popstate is called:
     * https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event#when_popstate_is_sent
     */
    this._watcherHandle = setInterval(checkUrl, LOCATION_WATCHER_INTERVAL_MS);

    const removeListener = addWindowEventListener('popstate', checkUrl);

    this._cleanupListeners = () => {
      removeListener();
    };
  }

  /**
   * Stop watching for location changes.
   */
  close(): void {
    if (this._watcherHandle) {
      clearInterval(this._watcherHandle);
    }
    this._cleanupListeners?.();
  }
}
