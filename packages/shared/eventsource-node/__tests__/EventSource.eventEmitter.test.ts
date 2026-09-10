import { EventSource } from '../src/EventSource';
import { deliberatelyUnusedPort } from './helpers';

const unusedUrl = `http://localhost:${deliberatelyUnusedPort}`;

// Matches the existing style elsewhere in this suite for a synchronous, no-network test: a
// default onerror keeps the pending (and never-to-succeed) connection attempt from crashing the
// test if it happens to fail asynchronously mid-test.
function newEventSource(): EventSource {
  const es = new EventSource(unusedUrl);
  es.onerror = () => {};
  return es;
}

it('delivers a dispatched event to a listener registered with on()', () => {
  const es = newEventSource();
  const received: unknown[] = [];
  es.on('greeting', (e) => received.push(e));
  es.emit('greeting', 'hi');
  expect(received).toEqual(['hi']);
  es.close();
});

it('addListener is an alias for on()', () => {
  const es = newEventSource();
  const received: unknown[] = [];
  es.addListener('greeting', (e) => received.push(e));
  es.emit('greeting', 'hi');
  expect(received).toEqual(['hi']);
  es.close();
});

it('once() removes the listener after its first invocation', () => {
  const es = newEventSource();
  const received: unknown[] = [];
  es.once('greeting', (e) => received.push(e));
  es.emit('greeting', 'first');
  es.emit('greeting', 'second');
  expect(received).toEqual(['first']);
  es.close();
});

it('removeListener stops delivery to that listener', () => {
  const es = newEventSource();
  const received: unknown[] = [];
  const listener = (e: unknown): void => {
    received.push(e);
  };
  es.on('greeting', listener);
  es.removeListener('greeting', listener);
  es.emit('greeting', 'hi');
  expect(received).toEqual([]);
  es.close();
});

it('off is an alias for removeListener', () => {
  const es = newEventSource();
  const received: unknown[] = [];
  const listener = (e: unknown): void => {
    received.push(e);
  };
  es.on('greeting', listener);
  es.off('greeting', listener);
  es.emit('greeting', 'hi');
  expect(received).toEqual([]);
  es.close();
});

it('removeAllListeners(type) clears every listener for that type only', () => {
  const es = newEventSource();
  const greetings: unknown[] = [];
  const messages: unknown[] = [];
  es.on('greeting', (e) => greetings.push(e));
  es.on('message', (e) => messages.push(e));
  es.removeAllListeners('greeting');
  es.emit('greeting', 'hi');
  es.emit('message', 'hello');
  expect(greetings).toEqual([]);
  expect(messages).toEqual(['hello']);
  es.close();
});

it('removeAllListeners() with no type clears every type', () => {
  const es = newEventSource();
  const greetings: unknown[] = [];
  es.on('greeting', (e) => greetings.push(e));
  es.removeAllListeners();
  es.emit('greeting', 'hi');
  expect(greetings).toEqual([]);
  es.close();
});

it('prependListener registers ahead of an already-registered listener', () => {
  const es = newEventSource();
  const order: string[] = [];
  es.on('greeting', () => order.push('first'));
  es.prependListener('greeting', () => order.push('second'));
  es.emit('greeting');
  expect(order).toEqual(['second', 'first']);
  es.close();
});

it('prependOnceListener registers ahead and self-removes after one invocation', () => {
  const es = newEventSource();
  const order: string[] = [];
  es.on('greeting', () => order.push('normal'));
  es.prependOnceListener('greeting', () => order.push('once'));
  es.emit('greeting');
  es.emit('greeting');
  expect(order).toEqual(['once', 'normal', 'normal']);
  es.close();
});

it('listeners() returns the registered listeners for a type in order', () => {
  const es = newEventSource();
  const a = (): void => {};
  const b = (): void => {};
  es.on('greeting', a);
  es.on('greeting', b);
  expect(es.listeners('greeting')).toEqual([a, b]);
  es.close();
});

it('rawListeners() returns the registered listeners for a type', () => {
  const es = newEventSource();
  const a = (): void => {};
  es.on('greeting', a);
  expect(es.rawListeners('greeting')).toEqual([a]);
  es.close();
});

it('listenerCount() counts listeners for a type', () => {
  const es = newEventSource();
  expect(es.listenerCount('greeting')).toEqual(0);
  es.on('greeting', () => {});
  es.on('greeting', () => {});
  expect(es.listenerCount('greeting')).toEqual(2);
  es.close();
});

it('eventNames() lists only types with at least one listener', () => {
  // newEventSource() presets onerror, which would make 'error' a second, unrelated entry here --
  // this test needs a genuinely empty registry, so it closes immediately instead.
  const es = new EventSource(unusedUrl);
  es.close();
  expect(es.eventNames()).toEqual([]);
  es.on('greeting', () => {});
  expect(es.eventNames()).toEqual(['greeting']);
});

it('setMaxListeners and getMaxListeners behave like a real EventEmitter', () => {
  // This class extends Node's EventEmitter directly, matching the package it was ported from, so
  // these are the real EventEmitter methods rather than package-specific no-ops.
  const es = newEventSource();
  expect(es.setMaxListeners(1)).toBe(es);
  expect(es.getMaxListeners()).toEqual(1);
  es.close();
});

it('on/once/removeListener/off/addListener/prependListener/prependOnceListener/removeAllListeners return this', () => {
  const es = newEventSource();
  const noop = (): void => {};
  expect(es.on('greeting', noop)).toBe(es);
  expect(es.once('greeting', noop)).toBe(es);
  expect(es.removeListener('greeting', noop)).toBe(es);
  expect(es.off('greeting', noop)).toBe(es);
  expect(es.addListener('greeting', noop)).toBe(es);
  expect(es.prependListener('greeting', noop)).toBe(es);
  expect(es.prependOnceListener('greeting', noop)).toBe(es);
  expect(es.removeAllListeners()).toBe(es);
  es.close();
});

it('onmessage and on("message", ...) share the same underlying registration', () => {
  const es = newEventSource();
  const received: string[] = [];
  es.onmessage = (e: { data: string }) => received.push(`slot:${e.data}`);
  es.on('message', (e: { data: string }) => received.push(`on:${e.data}`));
  expect(es.listenerCount('message')).toEqual(2);
  es.emit('message', { data: 'hi' });
  expect(received).toEqual(['slot:hi', 'on:hi']);
  es.close();
});

it('reassigning onmessage wipes any listener previously registered for the type', () => {
  // Matches the package this was ported from exactly: the on* setter is `this.removeAllListeners
  // (method); this.addEventListener(method, listener)`, so it wipes every listener for the type,
  // not just its own slot -- including one added directly through `.on()`. This is not full W3C
  // `on<type>` semantics (assigning `window.onerror` does not remove `addEventListener` listeners
  // there).
  const es = newEventSource();
  const received: string[] = [];
  const viaOn = (e: { data: string }): void => {
    received.push(`on:${e.data}`);
  };
  es.onmessage = () => received.push('first-slot');
  es.on('message', viaOn);
  es.onmessage = (e: { data: string }) => received.push(`second-slot:${e.data}`);
  expect(es.listenerCount('message')).toEqual(1);
  es.emit('message', { data: 'hi' });
  expect(received).toEqual(['second-slot:hi']);
  es.close();
});

it('removeListener on the current onmessage listener clears the slot too', () => {
  const es = newEventSource();
  const listener = (): void => {};
  es.onmessage = listener;
  es.removeListener('message', listener);
  expect(es.onmessage).toBeUndefined();
  expect(es.listenerCount('message')).toEqual(0);
  es.close();
});

it('throws when an error event is dispatched with no error listener registered', () => {
  const es = new EventSource(unusedUrl);
  // Closing first discards the pending connection attempt, so nothing but this test's own
  // deliberate emit() call can dispatch an 'error' event during the test.
  es.close();
  // No onerror, no addEventListener('error', ...), no on('error', ...) was ever set. This class
  // extends Node's EventEmitter directly, matching the package it was ported from, and inherits
  // its behavior of throwing synchronously when 'error' has no listener -- every internal SDK call
  // site sets `.onerror` immediately after construction, so this is not reached in practice there.
  expect(() => es.emit('error', { message: 'boom' })).toThrow();
});

it('still delivers to a real listener registered for error', () => {
  const es = new EventSource(unusedUrl);
  es.close();
  const received: unknown[] = [];
  es.on('error', (e) => received.push(e));
  es.emit('error', { message: 'boom' });
  expect(received).toEqual([{ message: 'boom' }]);
});
