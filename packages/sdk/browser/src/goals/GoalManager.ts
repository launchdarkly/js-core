import { LDUnexpectedResponseError, Requests } from '@launchdarkly/js-client-sdk-common';

import { getHref } from '../BrowserApi';
import { Goal } from './Goals';
import createGoalTracker, { GoalTracker } from './GoalTracker';
import { createLocationWatcher, LocationWatcher } from './LocationWatcher';

export interface GoalManager {
  initialize: () => Promise<void>;
  startTracking: () => void;
  close: () => void;
}

export default function createGoalManager(
  credential: string,
  requests: Requests,
  baseUrl: string,
  reportError: (err: Error) => void,
  reportGoal: (url: string, goal: Goal) => void,
  locationWatcherFactory: (cb: () => void) => LocationWatcher = createLocationWatcher,
): GoalManager {
  let goals: Goal[] | undefined = [];
  const url = `${baseUrl}/sdk/goals/${credential}`;
  let tracker: GoalTracker | undefined;
  let isTracking = false;

  const createTracker = () => {
    if (!isTracking) {
      return;
    }
    tracker?.close();
    if (goals && goals.length) {
      tracker = createGoalTracker(goals, (goal) => {
        reportGoal(getHref(), goal);
      });
    }
  };

  const watcher: LocationWatcher | undefined = locationWatcherFactory(() => {
    createTracker();
  });

  const fetchGoals = async (): Promise<void> => {
    try {
      const res = await requests.fetch(url);
      goals = await res.json();
    } catch (err) {
      reportError(new LDUnexpectedResponseError(`Encountered error fetching goals: ${err}`));
    }
  };

  return {
    async initialize(): Promise<void> {
      await fetchGoals();
      // If tracking has been started before goal fetching completes, we need to
      // create the tracker so it can start watching for events.
      createTracker();
    },

    startTracking() {
      isTracking = true;
      createTracker();
    },

    close(): void {
      watcher?.close();
      tracker?.close();
    },
  };
}
