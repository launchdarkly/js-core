import { LDUnexpectedResponseError, Requests } from '@launchdarkly/js-client-sdk-common';

import { getHref } from '../BrowserApi';
import { Goal } from './Goals';
import GoalTracker from './GoalTracker';
import { DefaultLocationWatcher, LocationWatcher } from './LocationWatcher';

export default class GoalManager {
  private _goals?: Goal[] = [];
  private _url: string;
  private _watcher?: LocationWatcher;
  private _tracker?: GoalTracker;
  private _isTracking = false;

  constructor(
    credential: string,
    private readonly _requests: Requests,
    baseUrl: string,
    private readonly _reportError: (err: Error) => void,
    private readonly _reportGoal: (url: string, goal: Goal) => void,
    locationWatcherFactory: (cb: () => void) => LocationWatcher = (cb) =>
      new DefaultLocationWatcher(cb),
  ) {
    // TODO: Generate URL in a better way.
    this._url = `${baseUrl}/sdk/goals/${credential}`;

    this._watcher = locationWatcherFactory(() => {
      this._createTracker();
    });
  }

  public async initialize(): Promise<void> {
    await this._fetchGoals();
    // If tracking has been started before goal fetching completes, we need to
    // create the tracker so it can start watching for events.
    this._createTracker();
  }

  public startTracking() {
    this._isTracking = true;
    this._createTracker();
  }

  private _createTracker() {
    if (!this._isTracking) {
      return;
    }
    this._tracker?.close();
    if (this._goals && this._goals.length) {
      this._tracker = new GoalTracker(this._goals, (goal) => {
        this._reportGoal(getHref(), goal);
      });
    }
  }

  private async _fetchGoals(): Promise<void> {
    try {
      const res = await this._requests.fetch(this._url);
      this._goals = await res.json();
    } catch (err) {
      this._reportError(new LDUnexpectedResponseError(`Encountered error fetching goals: ${err}`));
    }
  }

  close(): void {
    this._watcher?.close();
    this._tracker?.close();
  }
}
