import { createDefaultEventRegistry } from '../src/listenerRegistry';

it('dispatches an event to each listener registered for its type', () => {
  const registry = createDefaultEventRegistry();
  const received: unknown[] = [];
  registry.addEventListener('greeting', (e) => received.push(e));
  registry.addEventListener('greeting', (e) => received.push(e));
  const event = { type: 'greeting', data: 'hello' };
  registry.dispatch('greeting', event);
  expect(received).toEqual([event, event]);
});

it('does not dispatch to listeners registered for another type', () => {
  const registry = createDefaultEventRegistry();
  const received: unknown[] = [];
  registry.addEventListener('other', (e) => received.push(e));
  registry.dispatch('greeting', { type: 'greeting' });
  expect(received).toEqual([]);
});

it('does nothing when dispatching a type with no listeners', () => {
  const registry = createDefaultEventRegistry();
  expect(() => registry.dispatch('greeting', { type: 'greeting' })).not.toThrow();
});

it('removes a registered listener', () => {
  const registry = createDefaultEventRegistry();
  const received: unknown[] = [];
  const listener = (e: unknown) => received.push(e);
  registry.addEventListener('greeting', listener);
  registry.removeEventListener('greeting', listener);
  registry.dispatch('greeting', { type: 'greeting' });
  expect(received).toEqual([]);
});

it('removes at most one registration of a listener that registered twice', () => {
  const registry = createDefaultEventRegistry();
  let count = 0;
  const listener = () => {
    count += 1;
  };
  registry.addEventListener('greeting', listener);
  registry.addEventListener('greeting', listener);
  registry.removeEventListener('greeting', listener);
  registry.dispatch('greeting', {});
  expect(count).toEqual(1);
});

it('does nothing when removing a listener that never registered', () => {
  const registry = createDefaultEventRegistry();
  expect(() => registry.removeEventListener('greeting', () => {})).not.toThrow();
});

it('dispatches to a snapshot of the listener list', () => {
  const registry = createDefaultEventRegistry();
  const calls: string[] = [];
  const second = () => calls.push('second');
  registry.addEventListener('greeting', () => {
    calls.push('first');
    // Removed during this dispatch: still runs for this dispatch.
    registry.removeEventListener('greeting', second);
    // Added during this dispatch: does not run until the next dispatch.
    registry.addEventListener('greeting', () => calls.push('third'));
  });
  registry.addEventListener('greeting', second);
  registry.dispatch('greeting', {});
  expect(calls).toEqual(['first', 'second']);
});

it('treats prototype-chain names as ordinary event types', () => {
  const registry = createDefaultEventRegistry();
  // The server controls event type names through the SSE `event:` field, so names that collide
  // with Object.prototype members must behave like any other type.
  expect(() => registry.dispatch('__proto__', {})).not.toThrow();
  expect(() => registry.dispatch('constructor', {})).not.toThrow();
  const received: unknown[] = [];
  registry.addEventListener('__proto__', (e) => received.push(e));
  registry.dispatch('__proto__', { type: '__proto__' });
  expect(received).toEqual([{ type: '__proto__' }]);
});
