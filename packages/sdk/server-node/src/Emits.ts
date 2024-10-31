import { EventEmitter } from 'events';

export type EventableConstructor<T = {}> = new (...args: any[]) => T;
export type Eventable = EventableConstructor<{ emitter: EventEmitter }>;

/**
 * Adds the implementation of an event emitter to something that contains
 * a field of `emitter` with type `EventEmitter`.
 * @param Base The class to derive the mixin from.
 * @returns A class extending the base with an event emitter.
 */
export function Emits<TBase extends Eventable>(Base: TBase) {
  return class WithEvents extends Base implements EventEmitter {
    on(eventName: string | symbol, listener: (...args: any[]) => void): this {
      this.emitter.on(eventName, listener);
      return this;
    }

    addListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
      this.emitter.addListener(eventName, listener);
      return this;
    }

    once(eventName: string | symbol, listener: (...args: any[]) => void): this {
      this.emitter.once(eventName, listener);
      return this;
    }

    removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
      this.emitter.removeListener(eventName, listener);
      return this;
    }

    off(eventName: string | symbol, listener: (...args: any) => void): this {
      this.emitter.off(eventName, listener);
      return this;
    }

    removeAllListeners(event?: string | symbol): this {
      this.emitter.removeAllListeners(event);
      return this;
    }

    setMaxListeners(n: number): this {
      this.emitter.setMaxListeners(n);
      return this;
    }

    getMaxListeners(): number {
      return this.emitter.getMaxListeners();
    }

    listeners(eventName: string | symbol): Array<() => void> {
      return this.emitter.listeners(eventName);
    }

    rawListeners(eventName: string | symbol): Array<() => void> {
      return this.emitter.rawListeners(eventName);
    }

    emit(eventName: string | symbol, ...args: any[]): boolean {
      return this.emitter.emit(eventName, args);
    }

    listenerCount(eventName: string | symbol): number {
      return this.emitter.listenerCount(eventName);
    }

    prependListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
      this.emitter.prependListener(eventName, listener);
      return this;
    }

    prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
      this.emitter.prependOnceListener(eventName, listener);
      return this;
    }

    eventNames(): (string | symbol)[] {
      return this.emitter.eventNames();
    }
  };
}
