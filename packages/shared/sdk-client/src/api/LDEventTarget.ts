export type EventName = 'change' | 'internal-change' | 'ready' | 'initialized' | 'failed';

/**
 * Needs WebApi EventTarget.
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 *
 * In react-native use event-target-shim to polyfill EventTarget. This is safe
 * because the react-native repo uses it too.
 * https://github.com/mysticatea/event-target-shim
 */
export default class LDEventTarget extends EventTarget {
  private listeners: Map<EventName, EventListener[]> = new Map();

  /**
   * Cache all listeners in a Map so we can remove them later
   * @param e EventName
   * @param listener The event handler
   * @private
   */
  private saveListener(name: EventName, listener: EventListener) {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, [listener]);
    } else {
      this.listeners.get(name)?.push(listener);
    }
  }

  public on(name: EventName, listener: Function) {
    const customListener = (e: Event) => {
      const { detail } = e as CustomEvent;

      // invoke listener with additional args from CustomEvent.detail
      listener(...listener.arguments, ...detail);
    };
    this.saveListener(name, customListener);

    super.addEventListener(name, customListener);
  }

  public off(name: EventName) {
    this.listeners.get(name)?.forEach((l) => super.removeEventListener(name, l));
  }

  public emit(name: EventName, ...detail: any[]): boolean {
    const c = new CustomEvent(name, { detail });
    return super.dispatchEvent(c);
  }
}
