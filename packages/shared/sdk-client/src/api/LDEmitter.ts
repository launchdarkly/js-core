export type EventName = 'change' | 'internal-change' | 'ready' | 'initialized' | 'failed' | 'error';

/**
 * This is an event emitter using the standard built-in EventTarget web api.
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 *
 * In react-native use event-target-shim to polyfill EventTarget. This is safe
 * because the react-native repo uses it too.
 * https://github.com/mysticatea/event-target-shim
 */
export default class LDEmitter {
  private et: EventTarget = new EventTarget();
  private listeners: Map<EventName, EventListener[]> = new Map();

  /**
   * Cache all listeners in a Map so we can remove them later
   * @param name string event name
   * @param listener function to handle the event
   * @private
   */
  private saveListener(name: EventName, listener: EventListener) {
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
    this.saveListener(name, customListener);
    this.et.addEventListener(name, customListener);
  }

  off(name: EventName) {
    this.listeners.get(name)?.forEach((l) => this.et.removeEventListener(name, l));
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
