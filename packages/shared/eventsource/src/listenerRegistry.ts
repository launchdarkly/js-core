import { EventListenerRegistry, RegisteredEventListener } from './types';

/**
 * Creates the default `EventListenerRegistry`.
 */
export function createDefaultEventRegistry(): EventListenerRegistry {
  const listeners = new Map<string, RegisteredEventListener[]>();

  return {
    addEventListener(type: string, listener: RegisteredEventListener): void {
      const forType = listeners.get(type);
      if (forType) {
        forType.push(listener);
      } else {
        listeners.set(type, [listener]);
      }
    },

    removeEventListener(type: string, listener: RegisteredEventListener): void {
      const forType = listeners.get(type);
      if (!forType) {
        return;
      }
      // At most one registration is removed, the most recent one, as `removeListener` in
      // `EventEmitter` does. This keeps the default registry interchangeable with an
      // `EventEmitter`-backed substitute.
      for (let i = forType.length - 1; i >= 0; i -= 1) {
        if (forType[i] === listener) {
          forType.splice(i, 1);
          break;
        }
      }
      if (forType.length === 0) {
        listeners.delete(type);
      }
    },

    dispatch(type: string, event: unknown): void {
      // The loop iterates over a copy of the list, as `emit` in `EventEmitter` does. A listener
      // removed during this dispatch still runs. A listener added during this dispatch does not
      // run until the next dispatch. An exception from a listener stops the dispatch and reaches
      // the caller, as it does with NodeJS `EventEmitter`.
      listeners
        .get(type)
        ?.slice()
        .forEach((listener) => listener(event));
    },
  };
}
