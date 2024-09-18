import { jest } from '@jest/globals';

import { DefaultLocationWatcher, LOCATION_WATCHER_INTERVAL } from '../../src/goals/LocationWatcher';

let mockCallback: jest.Mock;

beforeEach(() => {
  mockCallback = jest.fn();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('should call callback when URL changes', () => {
  Object.defineProperty(window, 'location', {
    value: { href: 'https://example.com' },
    writable: true,
  });

  const watcher = new DefaultLocationWatcher(mockCallback);

  Object.defineProperty(window, 'location', {
    value: { href: 'https://example.com/new-page' },
    writable: true,
  });
  jest.advanceTimersByTime(LOCATION_WATCHER_INTERVAL);

  expect(mockCallback).toHaveBeenCalledTimes(1);

  watcher.close();
});

it('should not call callback when URL remains the same', () => {
  Object.defineProperty(window, 'location', {
    value: { href: 'https://example.com' },
    writable: true,
  });

  const watcher = new DefaultLocationWatcher(mockCallback);

  jest.advanceTimersByTime(LOCATION_WATCHER_INTERVAL * 2);

  expect(mockCallback).not.toHaveBeenCalled();

  watcher.close();
});

it('should call callback on popstate event', () => {
  Object.defineProperty(window, 'location', {
    value: { href: 'https://example.com' },
    writable: true,
  });

  const watcher = new DefaultLocationWatcher(mockCallback);

  Object.defineProperty(window, 'location', {
    value: { href: 'https://example.com/new-page' },
    writable: true,
  });
  window.dispatchEvent(new Event('popstate'));

  expect(mockCallback).toHaveBeenCalledTimes(1);

  watcher.close();
});

it('should stop watching when close is called', () => {
  Object.defineProperty(window, 'location', {
    value: { href: 'https://example.com' },
    writable: true,
  });

  const watcher = new DefaultLocationWatcher(mockCallback);

  watcher.close();

  Object.defineProperty(window, 'location', {
    value: { href: 'https://example.com/new-page' },
    writable: true,
  });
  jest.advanceTimersByTime(LOCATION_WATCHER_INTERVAL);
  window.dispatchEvent(new Event('popstate'));

  expect(mockCallback).not.toHaveBeenCalled();
});
