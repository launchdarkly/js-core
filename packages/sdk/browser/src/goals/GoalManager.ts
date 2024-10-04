import { LDUnexpectedResponseError, Requests } from '@launchdarkly/js-client-sdk-common';

import { Goal } from './Goals';
import GoalTracker from './GoalTracker';
import { DefaultLocationWatcher, LocationWatcher } from './LocationWatcher';
import { getHref } from '../BrowserApi';

export default class GoalManager {
  private goals?: Goal[] = [];
  private url: string;
  private watcher?: LocationWatcher;
  private tracker?: GoalTracker;
  private isTracking = false;

  constructor(
    credential: string,
    private readonly requests: Requests,
    baseUrl: string,
    private readonly reportError: (err: Error) => void,
    private readonly reportGoal: (url: string, goal: Goal) => void,
    locationWatcherFactory: (cb: () => void) => LocationWatcher = (cb) =>
      new DefaultLocationWatcher(cb),
  ) {
    // TODO: Generate URL in a better way.
    this.url = `${baseUrl}/sdk/goals/${credential}`;

    this.watcher = locationWatcherFactory(() => {
      this.createTracker();
    });
  }

  public async initialize(): Promise<void> {
    await this.fetchGoals();
    // If tracking has been started before goal fetching completes, we need to
    // create the tracker so it can start watching for events.
    this.createTracker();
  }

  public startTracking() {
    this.isTracking = true;
    this.createTracker();
  }

  private createTracker() {
    if (!this.isTracking) {
      return;
    }
    this.tracker?.close();
    if (this.goals && this.goals.length) {
      this.tracker = new GoalTracker(this.goals, (goal) => {
        this.reportGoal(getHref(), goal);
      });
    }
  }

  private async fetchGoals(): Promise<void> {
    try {
      const res = await this.requests.fetch(this.url);
      this.goals = await res.json();
    } catch (err) {
      this.reportError(new LDUnexpectedResponseError(`Encountered error fetching goals: ${err}`));
    }
  }

  close(): void {
    this.watcher?.close();
    this.tracker?.close();
  }
}
