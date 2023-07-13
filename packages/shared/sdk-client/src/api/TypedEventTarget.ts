export type EventName = 'change' | 'internal-change' | 'ready' | 'initialized' | 'failed';

// export type EventListener = (evt: Event) => void;

// rn does not have CustomEvent so this is our own polyfill
export class CustomEvent extends Event {
  detail: any[];

  constructor(e: string, ...rest: any[]) {
    super(e);
    this.detail = rest;
  }
}

/**
 * Needs WebApi EventTarget.
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 *
 * In react-native use event-target-shim to polyfill EventTarget. This is safe
 * because the react-native repo uses it too.
 * https://github.com/mysticatea/event-target-shim
 */
export default class TypedEventTarget extends EventTarget {
  private listeners: Map<EventName, Function[]> = new Map();

  /**
   * Cache all listeners in a Map so we can remove them later
   * @param e EventName
   * @param listener The event handler
   * @private
   */
  private saveListener(e: EventName, listener: Function) {
    if (!this.listeners.has(e)) {
      this.listeners.set(e, [listener]);
    } else {
      this.listeners.get(e)?.push(listener);
    }
  }

  public on(name: EventName, listener: Function) {
    this.on(new CustomEvent(name));
  }

  public on(e: CustomEvent, listener: Function) {
    const x = () => listener(...listener.arguments, ...e.detail);
    this.saveListener(e.type as EventName, x);
    super.addEventListener(e.type, x);
  }

  public off(e: EventName) {
    this.listeners.get(e)?.forEach((l) => super.removeEventListener(e, l));
  }

  public emit(e: EventName, ...rest: any[]): boolean {
    return super.dispatchEvent(new CustomEvent(e, ...rest));
  }
}
