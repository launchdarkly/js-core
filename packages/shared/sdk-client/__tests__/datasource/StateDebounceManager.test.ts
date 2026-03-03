import {
  createStateDebounceManager,
  DEFAULT_DEBOUNCE_MS,
  DesiredState,
  StateDebounceManager,
} from '../../src/datasource/StateDebounceManager';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const defaultInitialState: DesiredState = {
  networkState: 'available',
  lifecycleState: 'foreground',
  requestedMode: 'streaming',
};

function makeManager(
  onReconcile: jest.Mock = jest.fn(),
  initialState: DesiredState = defaultInitialState,
  debounceMs?: number,
): { manager: StateDebounceManager; onReconcile: jest.Mock } {
  const manager = createStateDebounceManager({
    initialState,
    onReconcile,
    debounceMs,
  });
  return { manager, onReconcile };
}

it('fires callback after debounce window when network state changes', () => {
  const { manager, onReconcile } = makeManager();

  manager.setNetworkState('unavailable');
  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS - 1);
  expect(onReconcile).not.toHaveBeenCalled();

  jest.advanceTimersByTime(1);
  expect(onReconcile).toHaveBeenCalledTimes(1);
  expect(onReconcile).toHaveBeenCalledWith({
    networkState: 'unavailable',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });

  manager.close();
});

it('fires callback after debounce window when lifecycle state changes', () => {
  const { manager, onReconcile } = makeManager();

  manager.setLifecycleState('background');
  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

  expect(onReconcile).toHaveBeenCalledTimes(1);
  expect(onReconcile).toHaveBeenCalledWith({
    networkState: 'available',
    lifecycleState: 'background',
    requestedMode: 'streaming',
  });

  manager.close();
});

it('fires callback after debounce window when connection mode changes', () => {
  const { manager, onReconcile } = makeManager();

  manager.setRequestedMode('polling');
  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

  expect(onReconcile).toHaveBeenCalledTimes(1);
  expect(onReconcile).toHaveBeenCalledWith({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'polling',
  });

  manager.close();
});

it('resets the timer when a new event arrives within the debounce window', () => {
  const { manager, onReconcile } = makeManager();

  manager.setNetworkState('unavailable');
  jest.advanceTimersByTime(500);
  expect(onReconcile).not.toHaveBeenCalled();

  // Second event resets the timer
  manager.setLifecycleState('background');
  jest.advanceTimersByTime(500);
  // 1000ms total elapsed, but only 500ms since last event — should not fire yet
  expect(onReconcile).not.toHaveBeenCalled();

  jest.advanceTimersByTime(500);
  // Now 1000ms since last event — should fire
  expect(onReconcile).toHaveBeenCalledTimes(1);
  expect(onReconcile).toHaveBeenCalledWith({
    networkState: 'unavailable',
    lifecycleState: 'background',
    requestedMode: 'streaming',
  });

  manager.close();
});

it('coalesces multiple rapid changes to the final state', () => {
  const { manager, onReconcile } = makeManager();

  manager.setNetworkState('unavailable');
  manager.setNetworkState('available');
  manager.setNetworkState('unavailable');
  manager.setNetworkState('available');

  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

  expect(onReconcile).toHaveBeenCalledTimes(1);
  expect(onReconcile).toHaveBeenCalledWith({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });

  manager.close();
});

it('delivers combined state from all dimensions changed in one window', () => {
  const { manager, onReconcile } = makeManager();

  manager.setNetworkState('unavailable');
  manager.setLifecycleState('background');
  manager.setRequestedMode('offline');

  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

  expect(onReconcile).toHaveBeenCalledTimes(1);
  expect(onReconcile).toHaveBeenCalledWith({
    networkState: 'unavailable',
    lifecycleState: 'background',
    requestedMode: 'offline',
  });

  manager.close();
});

it('does not fire callback if close() is called before timer fires', () => {
  const { manager, onReconcile } = makeManager();

  manager.setNetworkState('unavailable');
  manager.close();

  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

  expect(onReconcile).not.toHaveBeenCalled();
});

it('treats set* methods as no-ops after close()', () => {
  const { manager, onReconcile } = makeManager();

  manager.close();
  manager.setNetworkState('unavailable');
  manager.setLifecycleState('background');
  manager.setRequestedMode('polling');

  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS * 2);

  expect(onReconcile).not.toHaveBeenCalled();
});

it('reflects current accumulated state in desiredState immediately', () => {
  const { manager } = makeManager();

  expect(manager.desiredState).toEqual(defaultInitialState);

  manager.setNetworkState('unavailable');
  expect(manager.desiredState).toEqual({
    networkState: 'unavailable',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });

  manager.setLifecycleState('background');
  expect(manager.desiredState).toEqual({
    networkState: 'unavailable',
    lifecycleState: 'background',
    requestedMode: 'streaming',
  });

  manager.close();
});

it('respects a custom debounce duration', () => {
  const { manager, onReconcile } = makeManager(jest.fn(), defaultInitialState, 2000);

  manager.setNetworkState('unavailable');
  jest.advanceTimersByTime(1500);
  expect(onReconcile).not.toHaveBeenCalled();

  jest.advanceTimersByTime(500);
  expect(onReconcile).toHaveBeenCalledTimes(1);

  manager.close();
});

it('uses 1 second as the default debounce duration', () => {
  const { manager, onReconcile } = makeManager();

  manager.setNetworkState('unavailable');
  jest.advanceTimersByTime(999);
  expect(onReconcile).not.toHaveBeenCalled();

  jest.advanceTimersByTime(1);
  expect(onReconcile).toHaveBeenCalledTimes(1);

  manager.close();
});

it('only updates the dimension that was changed', () => {
  const { manager, onReconcile } = makeManager();

  manager.setNetworkState('unavailable');
  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

  expect(onReconcile).toHaveBeenCalledWith({
    networkState: 'unavailable',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });

  manager.close();
});

it('settles on the final value after rapid network flapping', () => {
  const { manager, onReconcile } = makeManager();

  // Simulate rapid network flapping (spec example 1)
  manager.setNetworkState('unavailable');
  manager.setNetworkState('available');
  manager.setNetworkState('unavailable');
  manager.setNetworkState('available');

  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

  expect(onReconcile).toHaveBeenCalledTimes(1);
  expect(onReconcile).toHaveBeenCalledWith({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });

  manager.close();
});

it('handles multiple dimensions changing within the same debounce window', () => {
  const { manager, onReconcile } = makeManager();

  // Simulate spec example 2: network restore + background transition
  manager.setNetworkState('available');
  manager.setLifecycleState('background');

  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

  expect(onReconcile).toHaveBeenCalledTimes(1);
  expect(onReconcile).toHaveBeenCalledWith({
    networkState: 'available',
    lifecycleState: 'background',
    requestedMode: 'streaming',
  });

  manager.close();
});

it('supports sequential debounce windows', () => {
  const { manager, onReconcile } = makeManager();

  // First window
  manager.setNetworkState('unavailable');
  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);
  expect(onReconcile).toHaveBeenCalledTimes(1);

  // Second window
  manager.setNetworkState('available');
  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);
  expect(onReconcile).toHaveBeenCalledTimes(2);
  expect(onReconcile).toHaveBeenLastCalledWith({
    networkState: 'available',
    lifecycleState: 'foreground',
    requestedMode: 'streaming',
  });

  manager.close();
});

it('does not fire callback when no state changes are made', () => {
  const { manager, onReconcile } = makeManager();

  jest.advanceTimersByTime(DEFAULT_DEBOUNCE_MS * 5);

  expect(onReconcile).not.toHaveBeenCalled();

  manager.close();
});

it('can be closed multiple times without error', () => {
  const { manager } = makeManager();

  expect(() => {
    manager.close();
    manager.close();
    manager.close();
  }).not.toThrow();
});
