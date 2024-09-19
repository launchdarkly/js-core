import { jest } from '@jest/globals';

import { LDUnexpectedResponseError, Requests } from '@launchdarkly/js-client-sdk-common';

import GoalManager from '../../src/goals/GoalManager';
import { Goal } from '../../src/goals/Goals';
import { LocationWatcher } from '../../src/goals/LocationWatcher';

describe('given a GoalManager with mocked dependencies', () => {
  let mockRequests: jest.Mocked<Requests>;
  let mockReportError: jest.Mock;
  let mockReportGoal: jest.Mock;
  let mockLocationWatcherFactory: () => { cb?: () => void } & LocationWatcher;
  let mockLocationWatcher: { cb?: () => void } & LocationWatcher;
  let goalManager: GoalManager;
  const mockCredential = 'test-credential';

  beforeEach(() => {
    mockRequests = { fetch: jest.fn() } as any;
    mockReportError = jest.fn();
    mockReportGoal = jest.fn();
    mockLocationWatcher = { close: jest.fn() };
    // @ts-expect-error The type is correct, but TS cannot handle the jest.fn typing
    mockLocationWatcherFactory = jest.fn((cb: () => void) => {
      mockLocationWatcher.cb = cb;
      return mockLocationWatcher;
    });

    goalManager = new GoalManager(
      mockCredential,
      mockRequests,
      'polling',
      mockReportError,
      mockReportGoal,
      mockLocationWatcherFactory,
    );
  });

  it('should fetch goals and set up the location watcher', async () => {
    const mockGoals: Goal[] = [
      { key: 'goal1', kind: 'click', selector: '#button1' },
      { key: 'goal2', kind: 'click', selector: '#button2' },
    ];

    mockRequests.fetch.mockResolvedValue({
      json: () => Promise.resolve(mockGoals),
    } as any);

    await goalManager.initialize();
    goalManager.startTracking();

    expect(mockRequests.fetch).toHaveBeenCalledWith('polling/sdk/goals/test-credential');
    expect(mockLocationWatcherFactory).toHaveBeenCalled();
  });

  it('should handle failed initial fetch by reporting an unexpected response error', async () => {
    const error = new Error('Fetch failed');

    mockRequests.fetch.mockRejectedValue(error);

    await goalManager.initialize();
    goalManager.startTracking();

    expect(mockReportError).toHaveBeenCalledWith(expect.any(LDUnexpectedResponseError));
  });

  it('should close the watcher and tracker when closed', () => {
    goalManager.close();

    expect(mockLocationWatcher.close).toHaveBeenCalled();
  });

  it('should not emit a goal on initial for a non-matching URL, but should emit after URL change to a matching URL', async () => {
    const mockGoals: Goal[] = [
      {
        key: 'goal1',
        kind: 'pageview',
        urls: [
          {
            kind: 'exact',
            url: 'https://example.com/target',
          },
        ],
      },
    ];

    Object.defineProperty(window, 'location', {
      value: { href: 'https://example.com/not-target' },
      writable: true,
    });

    mockRequests.fetch.mockResolvedValue({
      json: () => Promise.resolve(mockGoals),
    } as any);
    await goalManager.initialize();
    goalManager.startTracking();

    // Check that no goal was emitted on initial load
    expect(mockReportGoal).not.toHaveBeenCalled();

    // Simulate URL change to match the goal
    Object.defineProperty(window, 'location', {
      value: { href: 'https://example.com/target' },
      writable: true,
    });

    // Trigger the location change callback
    mockLocationWatcher.cb?.();

    // Check that the goal was emitted after URL change
    expect(mockReportGoal).toHaveBeenCalledWith('https://example.com/target', {
      key: 'goal1',
      kind: 'pageview',
      urls: [{ kind: 'exact', url: 'https://example.com/target' }],
    });
  });
});
