// launchdarkly-js-test-helpers is a dev dependency and the linter doesn't understand that this
// file is only used by tests.
// eslint-disable-next-line import/no-extraneous-dependencies
import { AsyncQueue, TestHttpHandlers } from 'launchdarkly-js-test-helpers';

import { CLOSED, createEventSource } from '../src/EventSource';
import { createDefaultEventRegistry } from '../src/listenerRegistry';
import { EventListenerRegistry, MessageEvent } from '../src/types';
import {
  deliberatelyUnusedPort,
  startErrorQueue,
  waitForOpenEvent,
  withServer,
  withServerOnPort,
  writeEvents,
} from './helpers';

const unusedUrl = `http://localhost:${deliberatelyUnusedPort}`;

/**
 * A throwing on* slot now rethrows asynchronously, on a later microtask (see `emit` in
 * `createEventSource`), so it still reaches a real host as an uncaught error without touching
 * this package's own control flow. Under a real `queueMicrotask`, that later throw would reach
 * the test runner as an uncaught exception instead of failing the assertion that provoked it.
 * This helper replaces `queueMicrotask` for the duration of `action`, running the scheduled
 * callback right away and collecting what it throws -- the expected rethrow -- so the test can
 * check the rest of `emit`'s control flow undisturbed, and also assert on which errors were
 * rethrown.
 */
async function withSlotRethrowSwallowed(action: () => Promise<void>): Promise<unknown[]> {
  const original = global.queueMicrotask;
  const swallowed: unknown[] = [];
  global.queueMicrotask = (callback: () => void): void => {
    try {
      callback();
    } catch (err) {
      // Expected: this is the async rethrow that a throwing on* slot causes.
      swallowed.push(err);
    }
  };
  try {
    await action();
  } finally {
    global.queueMicrotask = original;
  }
  return swallowed;
}

it('invokes onclose once, before the closed listeners, when close() is called', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([]));
    const es = createEventSource(server.url);
    es.onerror = () => {};
    await waitForOpenEvent(es);
    const calls: string[] = [];
    es.onclose = () => calls.push('onclose');
    es.addEventListener('closed', () => calls.push('closed-listener'));
    es.close();
    expect(calls).toEqual(['onclose', 'closed-listener']);
    // close() is idempotent: a second call does not invoke onclose again.
    es.close();
    expect(calls).toEqual(['onclose', 'closed-listener']);
  });
});

it('still dispatches the closed event, and rethrows, when onclose throws', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([]));
    const es = createEventSource(server.url);
    es.onerror = () => {};
    await waitForOpenEvent(es);
    const calls: string[] = [];
    const thrown = new Error('onclose boom');
    es.onclose = () => {
      throw thrown;
    };
    es.addEventListener('closed', () => calls.push('closed-listener'));
    expect(() => es.close()).toThrow(thrown);
    expect(calls).toEqual(['closed-listener']);
    expect(es.readyState).toEqual(CLOSED);
  });
});

it('does not invoke onclose when a non-retryable error ends the stream', async () => {
  const calls = new AsyncQueue<string>();
  const es = createEventSource(unusedUrl, { errorFilter: () => false });
  es.onerror = () => calls.add('onerror');
  es.onclose = () => calls.add('onclose');
  es.addEventListener('closed', () => calls.add('closed-listener'));
  expect(await calls.take()).toEqual('onerror');
  // The terminal 'closed' event still fires, but onclose stays silent: the errorFilter caller
  // already received the error, and onclose reports only a close() call.
  expect(await calls.take()).toEqual('closed-listener');
  // The stream is already in the terminal state, so this close() does nothing and must not
  // invoke onclose either.
  es.close();
  expect(calls.isEmpty()).toBe(true);
});

it('keeps addEventListener registrations when an on* slot is assigned afterwards', async () => {
  const calls = new AsyncQueue<string>();
  const es = createEventSource(unusedUrl, { errorFilter: () => false });
  es.addEventListener('error', () => calls.add('listener'));
  // With the accessors that were removed, this assignment would have wiped the listener above.
  es.onerror = () => calls.add('slot');
  // The slot runs before the listeners for the same dispatch.
  expect(await calls.take()).toEqual('slot');
  expect(await calls.take()).toEqual('listener');
  es.close();
});

it('throws a clear TypeError naming createEventRegistry when it or its result is not conformant', () => {
  expect(() =>
    createEventSource(unusedUrl, {
      // Missing dispatch, and addEventListener/removeEventListener are not functions: not a
      // conformant EventListenerRegistry.
      createEventRegistry: () => ({ addEventListener: 'nope', removeEventListener: 'nope' }) as any,
    }),
  ).toThrow(/createEventRegistry/);
  expect(
    // createEventRegistry itself is not a function, so the factory must reject it before ever
    // trying to call it.
    () => createEventSource(unusedUrl, { createEventRegistry: 'nope' as any }),
  ).toThrow(/createEventRegistry/);
});

it('routes registration, removal, and dispatch through a registry from createEventRegistry', async () => {
  const added: string[] = [];
  const removed: string[] = [];
  const dispatched: string[] = [];
  const inner = createDefaultEventRegistry();
  const registry: EventListenerRegistry = {
    addEventListener(type, listener) {
      added.push(type);
      inner.addEventListener(type, listener);
    },
    removeEventListener(type, listener) {
      removed.push(type);
      inner.removeEventListener(type, listener);
    },
    dispatch(type, event) {
      dispatched.push(type);
      inner.dispatch(type, event);
    },
  };
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: hello\n\n']));
    const es = createEventSource(server.url, { createEventRegistry: () => registry });
    es.onerror = () => {};
    const messages = new AsyncQueue<MessageEvent>();
    const onMessage = (m: MessageEvent) => messages.add(m);
    es.addEventListener('message', onMessage);
    const m = await messages.take();
    expect(m.data).toEqual('hello');
    expect(added).toContain('message');
    expect(dispatched).toContain('open');
    expect(dispatched).toContain('message');
    es.removeEventListener('message', onMessage);
    expect(removed).toEqual(['message']);
    es.close();
    expect(dispatched).toContain('closed');
  });
});

it('still starts the read loop and delivers a message when onopen throws', async () => {
  const swallowed = await withSlotRethrowSwallowed(async () => {
    await withServer(async (server) => {
      server.byDefault(writeEvents(['data: hello\n\n']));
      const es = createEventSource(server.url);
      es.onerror = () => {};
      es.onopen = () => {
        throw new Error('onopen boom');
      };
      const messages = new AsyncQueue<MessageEvent>();
      es.addEventListener('message', (m) => messages.add(m));
      const m = await messages.take();
      expect(m.data).toEqual('hello');
      es.close();
    });
  });
  expect(swallowed.map((err) => (err as Error).message)).toEqual(['onopen boom']);
});

it('still notifies error listeners and still reconnects when onerror throws', async () => {
  const swallowed = await withSlotRethrowSwallowed(async () => {
    await withServer(async (server) => {
      server.byDefault(TestHttpHandlers.respond(500));
      const es = createEventSource(server.url, { initialRetryDelayMillis: 1 });
      es.onerror = () => {
        throw new Error('onerror boom');
      };
      const listenerCalls = new AsyncQueue<string>();
      es.addEventListener('error', () => listenerCalls.add('listener'));
      await listenerCalls.take();
      await server.closeAndWait();
      await withServerOnPort(server.port, async (reconnected) => {
        // A second connection attempt reaching this server proves the reconnect timer armed
        // despite the onerror throw above.
        reconnected.byDefault(writeEvents(['data: got it\n\n']));
        const messages = new AsyncQueue<MessageEvent>();
        es.addEventListener('message', (m) => messages.add(m));
        const m = await messages.take();
        expect(m.data).toEqual('got it');
      });
      es.close();
    });
  });
  expect(swallowed.map((err) => (err as Error).message)).toEqual(['onerror boom']);
});

it('still arms the reconnect timer and reconnects when onretrying throws', async () => {
  const swallowed = await withSlotRethrowSwallowed(async () => {
    await withServer(async (server) => {
      server.byDefault(TestHttpHandlers.respond(500));
      const es = createEventSource(server.url, { initialRetryDelayMillis: 1 });
      const errors = startErrorQueue(es);
      es.onretrying = () => {
        throw new Error('onretrying boom');
      };
      await errors.take();
      await server.closeAndWait();
      await withServerOnPort(server.port, async (reconnected) => {
        // A second connection attempt reaching this server proves the reconnect timer armed
        // despite the onretrying throw above.
        reconnected.byDefault(writeEvents(['data: got it\n\n']));
        const messages = new AsyncQueue<MessageEvent>();
        es.addEventListener('message', (m) => messages.add(m));
        const m = await messages.take();
        expect(m.data).toEqual('got it');
      });
      es.close();
    });
  });
  expect(swallowed.map((err) => (err as Error).message)).toEqual(['onretrying boom']);
});

it('still reconnects, and captures both errors, when the onerror slot and an error listener throw', async () => {
  // The slot's rethrow is queued before the listeners dispatch, and a registered listener's
  // exception is deferred the same way. Both errors surface asynchronously, in dispatch order,
  // and neither disturbs the stream's own control flow. The reconnect below proves the
  // reconnect logic survived both throws.
  const errorSeen = new AsyncQueue<string>();
  const swallowed = await withSlotRethrowSwallowed(async () => {
    await withServer(async (server) => {
      server.byDefault(TestHttpHandlers.respond(500));
      const es = createEventSource(server.url, { initialRetryDelayMillis: 1 });
      es.onerror = () => {
        throw new Error('onerror boom');
      };
      es.addEventListener('error', () => {
        errorSeen.add('error');
        throw new Error('listener boom');
      });
      await errorSeen.take();
      await server.closeAndWait();
      await withServerOnPort(server.port, async (reconnected) => {
        reconnected.byDefault(writeEvents(['data: got it\n\n']));
        const messages = new AsyncQueue<MessageEvent>();
        es.addEventListener('message', (m) => messages.add(m));
        const m = await messages.take();
        expect(m.data).toEqual('got it');
      });
      es.close();
    });
  });
  // The stream keeps retrying between the two servers, so the pair can repeat; the order of
  // the first pair is what matters.
  expect(swallowed.slice(0, 2).map((err) => (err as Error).message)).toEqual([
    'onerror boom',
    'listener boom',
  ]);
});
