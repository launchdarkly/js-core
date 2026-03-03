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
 * The composite pending state tracked by the debounce manager.
 * Each field represents one dimension of state that can change
 * independently. This state accumulates during the debounce window
 * and is delivered to the reconciliation callback when the timer fires.
 */
export interface PendingState {
  readonly networkState: NetworkState;
  readonly lifecycleState: LifecycleState;
  readonly requestedMode: FDv2ConnectionMode;
}

/**
 * Callback invoked when the debounce timer fires. Receives the
 * final accumulated pending state after the debounce window closes.
 */
export type ReconciliationCallback = (pendingState: PendingState) => void;

/** Default debounce window duration in milliseconds. */
export const DEFAULT_DEBOUNCE_MS = 1000;

/**
 * Manages debouncing of network availability, lifecycle, and
 * connection mode change events. Each event updates the relevant
 * component of the pending state and resets the debounce timer.
 * When the timer fires, the reconciliation callback is invoked
 * with the final combined pending state.
 *
 * `identify()` does NOT participate in the debounce window
 * (CONNMODE spec 3.5.6). Consumers must handle identify separately.
 */
export interface StateDebounceManager {
  /**
   * Update the pending network state. Resets the debounce timer.
   */
  setNetworkState(state: NetworkState): void;

  /**
   * Update the pending lifecycle state. Resets the debounce timer.
   */
  setLifecycleState(state: LifecycleState): void;

  /**
   * Update the pending connection mode. Resets the debounce timer.
   * This is how `setConnectionMode()` participates in debouncing
   * (CONNMODE spec 3.5.5).
   */
  setRequestedMode(mode: FDv2ConnectionMode): void;

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
  /** The initial pending state at construction time. */
  initialState: PendingState;

  /**
   * Callback invoked when the debounce timer fires with the
   * final resolved pending state.
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
 * of the pending state and resets the debounce timer. When the timer
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

  function getPendingState(): PendingState {
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
        onReconcile(getPendingState());
      }
    }, debounceMs);
  }

  return {
    setNetworkState(state: NetworkState): void {
      networkState = state;
      resetTimer();
    },

    setLifecycleState(state: LifecycleState): void {
      lifecycleState = state;
      resetTimer();
    },

    setRequestedMode(mode: FDv2ConnectionMode): void {
      requestedMode = mode;
      resetTimer();
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
