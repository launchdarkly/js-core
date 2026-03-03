import FDv2ConnectionMode from '../api/datasource/FDv2ConnectionMode';

/**
 * Network availability as reported by the platform.
 * - `'available'`: network is reachable
 * - `'unavailable'`: network is not reachable
 */
export type NetworkState = 'available' | 'unavailable';

/**
 * Application lifecycle state as reported by the platform.
 * - `'foreground'`: application is in the foreground / visible
 * - `'background'`: application is in the background / hidden
 */
export type LifecycleState = 'foreground' | 'background';

/**
 * The composite desired state tracked by the debounce manager.
 * Each field represents one dimension of state that can change
 * independently.
 */
export interface DesiredState {
  readonly networkState: NetworkState;
  readonly lifecycleState: LifecycleState;
  readonly requestedMode: FDv2ConnectionMode;
}

/**
 * Callback invoked when the debounce timer fires. Receives the
 * final accumulated desired state after the debounce window closes.
 */
export type ReconciliationCallback = (desiredState: DesiredState) => void;

/** Default debounce window duration in milliseconds. */
export const DEFAULT_DEBOUNCE_MS = 1000;

/**
 * Manages debouncing of network availability, lifecycle, and
 * connection mode change events. Each event updates the relevant
 * component of the desired state and resets the debounce timer.
 * When the timer fires, the reconciliation callback is invoked
 * with the final combined desired state.
 *
 * `identify()` does NOT participate in the debounce window
 * (CONNMODE spec 3.5.6). Consumers must handle identify separately.
 */
export interface StateDebounceManager {
  /**
   * Update the desired network state. Resets the debounce timer.
   */
  setNetworkState(state: NetworkState): void;

  /**
   * Update the desired lifecycle state. Resets the debounce timer.
   */
  setLifecycleState(state: LifecycleState): void;

  /**
   * Update the desired connection mode. Resets the debounce timer.
   * This is how `setConnectionMode()` participates in debouncing
   * (CONNMODE spec 3.5.5).
   */
  setRequestedMode(mode: FDv2ConnectionMode): void;

  /**
   * Returns the current accumulated desired state (the state that
   * will be delivered to the reconciliation callback when the
   * debounce timer fires).
   */
  readonly desiredState: DesiredState;

  /**
   * Cancel any pending debounce timer and release resources.
   * After close(), further calls to set* methods are no-ops.
   */
  close(): void;
}

/**
 * Configuration for creating a {@link StateDebounceManager}.
 */
export interface StateDebounceManagerConfig {
  /** The initial desired state at construction time. */
  initialState: DesiredState;

  /**
   * Callback invoked when the debounce timer fires with the
   * final resolved desired state.
   */
  onReconcile: ReconciliationCallback;

  /**
   * Debounce window duration in milliseconds.
   * @default 1000 (1 second, per CONNMODE spec 3.5.4)
   */
  debounceMs?: number;
}

/**
 * Creates a {@link StateDebounceManager}.
 *
 * The manager accumulates state changes from network, lifecycle, and
 * connection mode events. Each event updates the relevant component
 * of the desired state and resets the debounce timer. When the timer
 * fires, the reconciliation callback receives the final combined state.
 *
 * @param config Configuration for the debounce manager.
 */
export function createStateDebounceManager(
  config: StateDebounceManagerConfig,
): StateDebounceManager {
  const { initialState, onReconcile, debounceMs = DEFAULT_DEBOUNCE_MS } = config;

  let { networkState, lifecycleState, requestedMode } = initialState;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  function getDesiredState(): DesiredState {
    return { networkState, lifecycleState, requestedMode };
  }

  function resetTimer(): void {
    if (closed) {
      return;
    }

    if (timer !== undefined) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = undefined;
      if (!closed) {
        onReconcile(getDesiredState());
      }
    }, debounceMs);
  }

  return {
    setNetworkState(state: NetworkState): void {
      if (closed) {
        return;
      }
      networkState = state;
      resetTimer();
    },

    setLifecycleState(state: LifecycleState): void {
      if (closed) {
        return;
      }
      lifecycleState = state;
      resetTimer();
    },

    setRequestedMode(mode: FDv2ConnectionMode): void {
      if (closed) {
        return;
      }
      requestedMode = mode;
      resetTimer();
    },

    get desiredState(): DesiredState {
      return getDesiredState();
    },

    close(): void {
      closed = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}
