import { LDLogger } from '@launchdarkly/js-sdk-common';
import { LDEmitterEventName } from '@launchdarkly/js-client-sdk-common';
import { LDClient } from '../BrowserClient';

type CompatOnlyEvents = 'ready' | 'failed' | 'initialized';
export type CompatEventName = LDEmitterEventName | CompatOnlyEvents;

const COMPAT_EVENTS: string[] = ['ready', 'failed', 'initialized'];

export default class LDEmitterCompat {
  private _listeners: Map<CompatEventName, Function[]> = new Map();

  constructor(private readonly _client: LDClient) { }

  on(name: CompatEventName, listener: Function) {
    if (COMPAT_EVENTS.includes(name)) {
      if (!this._listeners.has(name)) {
        this._listeners.set(name, [listener]);
      } else {
        this._listeners.get(name)?.push(listener);
      }
    } else {
      this._client.on(name, listener as (...args: any[]) => void)
    }
  }

  /**
   * Unsubscribe one or all events.
   *
   * @param name
   * @param listener Optional. If unspecified, all listeners for the event will be removed.
   */
  off(name: CompatEventName, listener?: Function) {
    if (COMPAT_EVENTS.includes(name)) {
      const existingListeners = this._listeners.get(name);
      if (!existingListeners) {
        return;
      }

      if (listener) {
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
    } else {
      this._client.off(name, listener as (...args: any[]) => void)
    }
  }

  private _invokeListener(listener: Function, name: CompatEventName, ...detail: any[]) {
    try {
      listener(...detail);
    } catch (err) {
      this._client.logger.error(`Encountered error invoking handler for "${name}", detail: "${err}"`);
    }
  }

  emit(name: CompatEventName, ...detail: any[]) {
    const listeners = this._listeners.get(name);
    listeners?.forEach((listener) => this._invokeListener(listener, name, ...detail));
  }

  eventNames(): string[] {
    return [...this._listeners.keys()];
  }

  listenerCount(name: CompatEventName): number {
    return this._listeners.get(name)?.length ?? 0;
  }
}
