import { VoidFunction } from '../../utils';

export type SdkEvent = 'change' | 'internal-change' | 'ready' | 'initialized' | 'failed';

/**
 * Needs WebApi EventTarget.
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 *
 * In react-native use event-target-shim to polyfill EventTarget. This is safe
 * because the react-native repo uses it too.
 * https://github.com/mysticatea/event-target-shim
 */
export default class TypedEventTarget extends EventTarget {
  private listeners: Map<SdkEvent, VoidFunction[]> = new Map();

  public on(e: SdkEvent, listener: Function, extra: any) {
    const listenerExtra = () => listener(...arguments, extra);

    if (!this.listeners.has(e)) {
      this.listeners.set(e, [listenerExtra]);
    } else {
      this.listeners.get(e)?.push(listenerExtra);
    }

    super.addEventListener(e, listenerExtra);
  }

  public off(e: SdkEvent) {
    this.listeners.get(e)?.forEach((l) => super.removeEventListener(e, l));
  }

  public emit(e: SdkEvent): boolean {
    return super.dispatchEvent(new Event(e));
  }
}
