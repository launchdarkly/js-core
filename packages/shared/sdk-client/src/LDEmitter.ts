import { LDLogger } from '@launchdarkly/js-sdk-common';

/**
 * Type for name of emitted events. 'change' is used for all flag changes. 'change:flag-name-here' is used
 * for specific flag changes.
 */
export type EventName = 'change' | 'dataSourceStatus' | 'error' | string;

/**
 * Implementation Note: There should not be any default listeners for change events in a client
 * implementation. Default listeners mean a client cannot determine when there are actual
 * application developer provided listeners. If we require default listeners, then we should add
 * a system to allow listeners which have counts independent of the primary listener counts.
 */
export default class LDEmitter {
  private listeners: Map<EventName, Function[]> = new Map();

  constructor(private logger?: LDLogger) {}

  on(name: EventName, listener: Function) {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, [listener]);
    } else {
      this.listeners.get(name)?.push(listener);
    }
  }

  /**
   * Unsubscribe one or all events.
   *
   * @param name
   * @param listener Optional. If unspecified, all listeners for the event will be removed.
   */
  off(name: EventName, listener?: Function) {
    const existingListeners = this.listeners.get(name);
    if (!existingListeners) {
      return;
    }

    if (listener) {
      // remove from internal cache
      const updated = existingListeners.filter((fn) => fn !== listener);
      if (updated.length === 0) {
        this.listeners.delete(name);
      } else {
        this.listeners.set(name, updated);
      }
      return;
    }

    // listener was not specified, so remove them all for that event
    this.listeners.delete(name);
  }

  private invokeListener(listener: Function, name: EventName, ...detail: any[]) {
    try {
      listener(...detail);
    } catch (err) {
      this.logger?.error(`Encountered error invoking handler for "${name}", detail: "${err}"`);
    }
  }

  emit(name: EventName, ...detail: any[]) {
    const listeners = this.listeners.get(name);
    listeners?.forEach((listener) => this.invokeListener(listener, name, ...detail));
  }

  eventNames(): string[] {
    return [...this.listeners.keys()];
  }

  listenerCount(name: EventName): number {
    return this.listeners.get(name)?.length ?? 0;
  }
}
