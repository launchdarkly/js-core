export type EventName = 'connecting' | 'ready' | 'error' | 'change';

type CustomEventListeners = {
  original: Function;
  custom: Function;
};
/**
 * Native api usage: EventTarget.
 *
 * This is an event emitter using the standard built-in EventTarget web api.
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 *
 * In react-native use event-target-shim to polyfill EventTarget. This is safe
 * because the react-native repo uses it too.
 * https://github.com/mysticatea/event-target-shim
 */
export default class LDEmitter {
  private et: EventTarget = new EventTarget();

  private listeners: Map<EventName, CustomEventListeners[]> = new Map();

  /**
   * Cache all listeners in a Map so we can remove them later
   * @param name string event name
   * @param originalListener pointer to the original function as specified by
   * the consumer
   * @param customListener pointer to the custom function based on original
   * listener. This is needed to allow for CustomEvents.
   * @private
   */
  private saveListener(name: EventName, originalListener: Function, customListener: Function) {
    const listener = { original: originalListener, custom: customListener };
    if (!this.listeners.has(name)) {
      this.listeners.set(name, [listener]);
    } else {
      this.listeners.get(name)?.push(listener);
    }
  }

  on(name: EventName, listener: Function) {
    const customListener = (e: Event) => {
      const { detail } = e as CustomEvent;

      // invoke listener with args from CustomEvent
      listener(...detail);
    };
    this.saveListener(name, listener, customListener);
    this.et.addEventListener(name, customListener);
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
      const toBeRemoved = existingListeners.find((c) => c.original === listener);
      this.et.removeEventListener(name, toBeRemoved?.custom as any);

      // remove from internal cache
      const updated = existingListeners.filter((l) => l.original !== listener);
      if (updated.length === 0) {
        this.listeners.delete(name);
      } else {
        this.listeners.set(name, updated);
      }
      return;
    }

    // remove all listeners
    existingListeners.forEach((l) => {
      this.et.removeEventListener(name, l.custom as any);
    });
    this.listeners.delete(name);
  }

  emit(name: EventName, ...detail: any[]) {
    this.et.dispatchEvent(new CustomEvent(name, { detail }));
  }

  eventNames(): string[] {
    return [...this.listeners.keys()];
  }

  listenerCount(name: EventName): number {
    return this.listeners.get(name)?.length ?? 0;
  }
}
