/* eslint-disable no-new */
// The tracker depends on side effects to test, so we need to disable no-new.
// The URL matching functionality is tested in GoalTracker.urlMatches.test.ts so this file does not
// exhaustively test URL matching. It instead tests the functionality of the tracker.
import { jest } from '@jest/globals';

import { Goal } from '../../src/goals/Goals';
import createGoalTracker from '../../src/goals/GoalTracker';

let mockOnEvent: jest.Mock;

beforeEach(() => {
  mockOnEvent = jest.fn();
  jest.spyOn(document, 'addEventListener');
  jest.spyOn(document, 'removeEventListener');
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('should trigger pageview goals on initialization', () => {
  const goals: Goal[] = [
    { key: 'page1', kind: 'pageview', urls: [{ kind: 'exact', url: 'http://example.com' }] },
  ];

  jest.spyOn(window, 'location', 'get').mockImplementation(
    () =>
      ({
        href: 'http://example.com',
        search: '',
        hash: '',
      }) as Location,
  );

  createGoalTracker(goals, mockOnEvent);

  expect(mockOnEvent).toHaveBeenCalledWith(goals[0]);
});

it('should not trigger pageview goals for non-matching URLs', () => {
  const goals: Goal[] = [
    { key: 'page1', kind: 'pageview', urls: [{ kind: 'exact', url: 'http://example.com' }] },
  ];

  jest.spyOn(window, 'location', 'get').mockImplementation(
    () =>
      ({
        href: 'http://other.com',
        search: '',
        hash: '',
      }) as Location,
  );

  createGoalTracker(goals, mockOnEvent);

  expect(mockOnEvent).not.toHaveBeenCalled();
});

it('should trigger click goals when matching elements are clicked', () => {
  const goals: Goal[] = [
    {
      key: 'click1',
      kind: 'click',
      selector: '.test',
      urls: [{ kind: 'exact', url: 'http://example.com' }],
    },
  ];

  jest.spyOn(window, 'location', 'get').mockImplementation(
    () =>
      ({
        href: 'http://example.com',
        search: '',
        hash: '',
      }) as Location,
  );

  const element = document.createElement('div');
  element.className = 'test';
  document.body.appendChild(element);

  createGoalTracker(goals, mockOnEvent);

  element.click();

  expect(mockOnEvent).toHaveBeenCalledWith(goals[0]);
});

it('should not trigger click goals for non-matching elements', () => {
  const goals: Goal[] = [
    {
      key: 'click1',
      kind: 'click',
      selector: '.test',
      urls: [{ kind: 'exact', url: 'http://example.com' }],
    },
  ];

  jest.spyOn(window, 'location', 'get').mockImplementation(
    () =>
      ({
        href: 'http://example.com',
        search: '',
        hash: '',
      }) as Location,
  );

  const element = document.createElement('div');
  element.className = 'other';
  document.body.appendChild(element);

  createGoalTracker(goals, mockOnEvent);

  element.click();

  expect(mockOnEvent).not.toHaveBeenCalled();
});

it('should trigger click goals for child elements', () => {
  const goals: Goal[] = [
    {
      key: 'click1',
      kind: 'click',
      selector: '.test',
      urls: [{ kind: 'exact', url: 'http://example.com' }],
    },
  ];

  jest.spyOn(window, 'location', 'get').mockImplementation(
    () =>
      ({
        href: 'http://example.com',
        search: '',
        hash: '',
      }) as Location,
  );

  const parent = document.createElement('div');
  parent.className = 'test';
  const child = document.createElement('div');
  parent.appendChild(child);
  document.body.appendChild(parent);

  createGoalTracker(goals, mockOnEvent);

  child.click();

  expect(mockOnEvent).toHaveBeenCalledWith(goals[0]);
});

it('should clean up event listeners when closed', () => {
  const goals: Goal[] = [
    {
      key: 'click1',
      kind: 'click',
      selector: '.test',
      urls: [{ kind: 'exact', url: 'http://example.com' }],
    },
  ];

  jest.spyOn(window, 'location', 'get').mockImplementation(
    () =>
      ({
        href: 'http://example.com',
        search: '',
        hash: '',
      }) as Location,
  );

  const element = document.createElement('div');
  element.className = 'test';
  document.body.appendChild(element);

  const tracker = createGoalTracker(goals, mockOnEvent);
  tracker.close();

  element.click();

  expect(mockOnEvent).not.toHaveBeenCalled();
});
