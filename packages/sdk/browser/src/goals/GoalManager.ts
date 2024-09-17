import {
  LDUnexpectedResponseError,
  Requests,
  ServiceEndpoints,
} from '@launchdarkly/js-client-sdk-common';

import { Goal } from './Goals';
import GoalTracker from './GoalTracker';
import { DefaultLocationWatcher, LocationWatcher } from './LocationWatcher';

export default class GoalManager {
  private goals?: Goal[] = [];
  private url: string;
  private watcher?: LocationWatcher;
  private tracker?: GoalTracker;

  constructor(
    private readonly credential: string,
    private readonly requests: Requests,
    private readonly serviceEndpoints: ServiceEndpoints,
    private readonly reportError: (err: Error) => void,
    private readonly reportGoal: (url: string, goal: Goal) => void,
    locationWatcherFactory: (cb: () => void) => LocationWatcher = (cb) =>
      new DefaultLocationWatcher(cb),
  ) {
    // TODO: Generate URL in a better way.
    this.url = `${this.serviceEndpoints.polling}/sdk/goals/${credential}`;

    this.watcher = locationWatcherFactory(() => {
      this.createTracker();
    });
  }

  public async initialize(): Promise<void> {
    await this.fetchGoals();
    this.createTracker();
  }

  private createTracker() {
    if (this.goals && this.goals.length) {
      this.tracker = new GoalTracker(this.goals, (goal) => {
        this.reportGoal(window.location.href, goal);
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
