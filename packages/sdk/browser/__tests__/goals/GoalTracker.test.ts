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

it('should add click event listener for click goals', () => {
  const goals: Goal[] = [
    {
      key: 'click1',
      kind: 'click',
      selector: '.button',
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

  createGoalTracker(goals, mockOnEvent);

  expect(document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), undefined);
});

it('should not add click event listener if no click goals', () => {
  const goals: Goal[] = [
    { key: 'page1', kind: 'pageview', urls: [{ kind: 'exact', url: 'http://example.com' }] },
  ];

  createGoalTracker(goals, mockOnEvent);

  expect(document.addEventListener).not.toHaveBeenCalled();
});

it('should trigger click goals when matching element is clicked', () => {
  const goals: Goal[] = [
    {
      key: 'click1',
      kind: 'click',
      selector: '.button',
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

  createGoalTracker(goals, mockOnEvent);

  const button = document.createElement('button');
  button.className = 'button';
  document.body.appendChild(button);
  button.click();

  expect(mockOnEvent).toHaveBeenCalledWith(goals[0]);

  document.body.removeChild(button);
});

it('should not trigger click goals when matching element is clicked but URL does not match', () => {
  const goals: Goal[] = [
    {
      key: 'click1',
      kind: 'click',
      selector: '.button',
      urls: [{ kind: 'exact', url: 'http://example.com' }],
    },
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

  const button = document.createElement('button');
  button.className = 'button';
  document.body.appendChild(button);
  button.click();

  expect(mockOnEvent).not.toHaveBeenCalled();

  document.body.removeChild(button);
});

it('should remove click event listener on close', () => {
  const goals: Goal[] = [
    {
      key: 'click1',
      kind: 'click',
      selector: '.button',
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

  const tracker = createGoalTracker(goals, mockOnEvent);
  tracker.close();

  expect(document.removeEventListener).toHaveBeenCalledWith(
    'click',
    expect.any(Function),
    undefined,
  );
});

it('should trigger the click goal for parent elements which match the selector', () => {
  const goals: Goal[] = [
    {
      key: 'click1',
      kind: 'click',
      selector: '.my-selector',
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

  createGoalTracker(goals, mockOnEvent);

  const parent = document.createElement('div');
  parent.className = 'my-selector';
  document.body.appendChild(parent);

  const button = document.createElement('button');
  button.className = 'my-selector';
  parent.appendChild(button);

  button.click();

  expect(mockOnEvent).toHaveBeenCalledTimes(2);
});
