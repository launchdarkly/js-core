import { Initializer } from './Initializer';
import { Synchronizer } from './Synchronizer';

/**
 * Factory function that creates an {@link Initializer} instance.
 *
 * @param selectorGetter Returns the current selector (basis) string, or
 *   `undefined` if no selector is available.
 */
export type InitializerFactory = (selectorGetter: () => string | undefined) => Initializer;

/**
 * Factory function that creates a {@link Synchronizer} instance.
 *
 * @param selectorGetter Returns the current selector (basis) string, or
 *   `undefined` if no selector is available.
 */
export type SynchronizerFactory = (selectorGetter: () => string | undefined) => Synchronizer;

/**
 * State of a synchronizer slot.
 * - `'available'`: can be selected for use.
 * - `'blocked'`: has been blocked (e.g., terminal error or not yet activated).
 */
export type SynchronizerSlotState = 'available' | 'blocked';

/**
 * A slot in the synchronizer list, wrapping a factory with state metadata.
 */
export interface SynchronizerSlot {
  readonly factory: SynchronizerFactory;
  readonly isFDv1Fallback: boolean;
  state: SynchronizerSlotState;
}

/**
 * Creates a {@link SynchronizerSlot}.
 *
 * @param factory The synchronizer factory function.
 * @param options Optional configuration.
 * @param options.isFDv1Fallback Whether this slot is the FDv1 fallback adapter.
 *   FDv1 slots start `'blocked'` by default.
 * @param options.initialState Override the initial state (defaults to
 *   `'blocked'` for FDv1 slots, `'available'` otherwise).
 */
export function createSynchronizerSlot(
  factory: SynchronizerFactory,
  options?: {
    isFDv1Fallback?: boolean;
    initialState?: SynchronizerSlotState;
  },
): SynchronizerSlot {
  const isFDv1Fallback = options?.isFDv1Fallback ?? false;
  const state = options?.initialState ?? (isFDv1Fallback ? 'blocked' : 'available');
  return { factory, isFDv1Fallback, state };
}

/**
 * Manages the state of initializers and synchronizers, tracks which source
 * is active, and handles source transitions.
 */
export interface SourceManager {
  /**
   * Get the next initializer and set it as the active source.
   * Closes the previous active source. Returns `undefined` when all
   * initializers are exhausted.
   */
  getNextInitializerAndSetActive(): Initializer | undefined;

  /**
   * Get the next available (non-blocked) synchronizer and set it as the
   * active source. Closes the previous active source. Returns `undefined`
   * when all available synchronizers have been visited.
   */
  getNextAvailableSynchronizerAndSetActive(): Synchronizer | undefined;

  /** Mark the current synchronizer as blocked (e.g., after terminal error). */
  blockCurrentSynchronizer(): void;

  /** Reset the synchronizer index to -1 so the next call starts from the beginning. */
  resetSourceIndex(): void;

  /** Block all non-FDv1 synchronizers and unblock FDv1 synchronizers. */
  fdv1Fallback(): void;

  /** True if the current synchronizer is the first available (primary). */
  isPrimeSynchronizer(): boolean;

  /** Count of synchronizers in `'available'` state. */
  getAvailableSynchronizerCount(): number;

  /** True if any synchronizer slot is marked as an FDv1 fallback. */
  hasFDv1Fallback(): boolean;

  /** Close the active source and mark the manager as shut down. */
  close(): void;

  /** True if {@link close} has been called. */
  readonly isShutdown: boolean;
}

/**
 * Creates a {@link SourceManager} that coordinates initializer and
 * synchronizer lifecycle.
 *
 * @param initializerFactories Ordered list of initializer factories.
 * @param synchronizerSlots Ordered list of synchronizer slots with state.
 * @param selectorGetter Closure that returns the current selector string.
 */
export function createSourceManager(
  initializerFactories: InitializerFactory[],
  synchronizerSlots: SynchronizerSlot[],
  selectorGetter: () => string | undefined,
): SourceManager {
  function setSlotState(slot: SynchronizerSlot, state: SynchronizerSlotState) {
    // eslint-disable-next-line no-param-reassign
    slot.state = state;
  }

  let activeSource: { close(): void } | undefined;
  let initializerIndex = -1;
  let synchronizerIndex = -1;
  let isShutdown = false;

  function closeActiveSource() {
    if (activeSource) {
      activeSource.close();
      activeSource = undefined;
    }
  }

  function findFirstAvailableIndex(): number {
    return synchronizerSlots.findIndex((slot) => slot.state === 'available');
  }

  return {
    get isShutdown() {
      return isShutdown;
    },

    getNextInitializerAndSetActive(): Initializer | undefined {
      if (isShutdown) {
        return undefined;
      }

      initializerIndex += 1;
      if (initializerIndex >= initializerFactories.length) {
        return undefined;
      }

      closeActiveSource();
      const initializer = initializerFactories[initializerIndex](selectorGetter);
      activeSource = initializer;
      return initializer;
    },

    getNextAvailableSynchronizerAndSetActive(): Synchronizer | undefined {
      if (isShutdown) {
        return undefined;
      }

      // Scan forward from current position for the next available slot.
      const startIndex = synchronizerIndex + 1;
      const foundIndex = synchronizerSlots.findIndex(
        (slot, i) => i >= startIndex && slot.state === 'available',
      );

      if (foundIndex === -1) {
        return undefined;
      }

      closeActiveSource();
      synchronizerIndex = foundIndex;
      const synchronizer = synchronizerSlots[foundIndex].factory(selectorGetter);
      activeSource = synchronizer;
      return synchronizer;
    },

    blockCurrentSynchronizer() {
      if (synchronizerIndex >= 0 && synchronizerIndex < synchronizerSlots.length) {
        setSlotState(synchronizerSlots[synchronizerIndex], 'blocked');
      }
    },

    resetSourceIndex() {
      synchronizerIndex = -1;
    },

    fdv1Fallback() {
      synchronizerSlots.forEach((slot) => {
        setSlotState(slot, slot.isFDv1Fallback ? 'available' : 'blocked');
      });
    },

    isPrimeSynchronizer(): boolean {
      return synchronizerIndex === findFirstAvailableIndex();
    },

    getAvailableSynchronizerCount(): number {
      return synchronizerSlots.filter((slot) => slot.state === 'available').length;
    },

    hasFDv1Fallback(): boolean {
      return synchronizerSlots.some((slot) => slot.isFDv1Fallback);
    },

    close() {
      isShutdown = true;
      closeActiveSource();
    },
  };
}
