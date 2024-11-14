import { LDLogger } from '@launchdarkly/js-sdk-common';

type FlagChangeKey = `change:${string}`;

/**
 * Type for name of emitted events. 'change' is used for all flag changes. 'change:flag-name-here' is used
 * for specific flag changes.
 */
export type EventName = 'change' | FlagChangeKey | 'dataSourceStatus' | 'error';

/**
 * Implementation Note: There should not be any default listeners for change events in a client
 * implementation. Default listeners mean a client cannot determine when there are actual
 * application developer provided listeners. If we require default listeners, then we should add
 * a system to allow listeners which have counts independent of the primary listener counts.
 */
export default class LDEmitter {
  private _listeners: Map<EventName, Function[]> = new Map();

  constructor(private _logger?: LDLogger) {}

  on(name: EventName, listener: Function) {
    if (!this._listeners.has(name)) {
      this._listeners.set(name, [listener]);
    } else {
      this._listeners.get(name)?.push(listener);
    }
  }

  /**
   * Unsubscribe one or all events.
   *
   * @param name
   * @param listener Optional. If unspecified, all listeners for the event will be removed.
   */
  off(name: EventName, listener?: Function) {
    const existingListeners = this._listeners.get(name);
    if (!existingListeners) {
      return;
    }

    if (listener) {
      // remove from internal cache
      const updated = existingListeners.filter((fn) => fn !== listener);
      if (updated.length === 0) {
        this._listeners.delete(name);
      } else {
        this._listeners.set(name, updated);
      }
      return;
    }

    // listener was not specified, so remove them all for that event
    this._listeners.delete(name);
  }

  private _invokeListener(listener: Function, name: EventName, ...detail: any[]) {
    try {
      listener(...detail);
    } catch (err) {
      this._logger?.error(`Encountered error invoking handler for "${name}", detail: "${err}"`);
    }
  }

  emit(name: EventName, ...detail: any[]) {
    const listeners = this._listeners.get(name);
    listeners?.forEach((listener) => this._invokeListener(listener, name, ...detail));
  }

  eventNames(): string[] {
    return [...this._listeners.keys()];
  }

  listenerCount(name: EventName): number {
    return this._listeners.get(name)?.length ?? 0;
  }
}
