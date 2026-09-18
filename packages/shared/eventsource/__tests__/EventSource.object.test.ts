import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { CLOSED, CONNECTING, createEventSource, OPEN } from '../src/EventSource';
import { ErrorEvent } from '../src/types';
import {
  deliberatelyUnusedPort,
  startMessageQueue,
  waitForOpenEvent,
  withEventSource,
  withServer,
  withServerOnPort,
  writeEvents,
} from './helpers';

const unusedUrl = `http://localhost:${deliberatelyUnusedPort}`;

// The on* slots and reconnectInterval are the only own, enumerable keys of the object
// createEventSource returns. readyState, url, addEventListener, removeEventListener, and close
// are also own properties, but non-enumerable: a class's accessors and methods live on its
// prototype, never as the instance's own property, so they never appeared in
// Object.keys()/JSON.stringify() either. The on* slots are now own, enumerable keys initialized
// to undefined; JSON.stringify() output stays identical to the class either way, since
// JSON.stringify() skips a property whose value is undefined. Every other own key is closure
// state, which never became a property of this object in the first place.
const enumerablePublicMembers = ['reconnectInterval', 'onopen', 'onerror', 'onretrying', 'onclose'];
const nonEnumerablePublicMembers = [
  'readyState',
  'url',
  'addEventListener',
  'removeEventListener',
  'close',
];
const publicMembers = [...enumerablePublicMembers, ...nonEnumerablePublicMembers];

it('has the W3C readyState values', () => {
  expect(CONNECTING).toEqual(0);
  expect(OPEN).toEqual(1);
  expect(CLOSED).toEqual(2);
});

it('is CONNECTING before the connection has been established', () => {
  const es = createEventSource(unusedUrl);
  es.onerror = () => {};
  expect(es.readyState).toEqual(CONNECTING);
  es.close();
});

it('is CONNECTING when the server has closed the connection', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([]));
    await withEventSource(server.url, { initialRetryDelayMillis: 10 }, async (es) => {
      // A server that ends the response produces a clean end-of-stream, which is reported as
      // `end` rather than `error`.
      const ended = new AsyncQueue<ErrorEvent | undefined>();
      es.addEventListener('end', (e) => ended.add(e));
      await waitForOpenEvent(es);
      server.close();
      await ended.take();
      expect(es.readyState).toEqual(CONNECTING);
    });
  });
});

it('is OPEN when the connection has been established', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([]));
    await withEventSource(server.url, undefined, async (es) => {
      await waitForOpenEvent(es);
      expect(es.readyState).toEqual(OPEN);
    });
  });
});

it('is CLOSED after the connection has been closed', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([]));
    await withEventSource(server.url, undefined, async (es) => {
      await waitForOpenEvent(es);
      es.close();
      expect(es.readyState).toEqual(CLOSED);
    });
  });
});

it('has a close method that returns undefined', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([]));
    await withEventSource(server.url, undefined, async (es) => {
      await waitForOpenEvent(es);
      expect(es.close()).toBeUndefined();
    });
  });
});

it('has a close method', () => {
  const es = createEventSource(unusedUrl);
  es.onerror = () => {};
  expect(typeof es.close).toEqual('function');
  es.close();
});

it('exposes the original request url', () => {
  const es = createEventSource(unusedUrl);
  es.onerror = () => {};
  es.close();
  expect(es.url).toEqual(unusedUrl);
});

it('does not expose configured headers as an enumerable property', () => {
  const es = createEventSource(unusedUrl, {
    headers: { authorization: 'sdk-key-should-not-leak' },
  });
  es.onerror = () => {};
  expect(JSON.stringify(es)).not.toContain('sdk-key-should-not-leak');
  expect(Object.keys(es).sort()).toEqual(enumerablePublicMembers.slice().sort());
  es.close();
});

it('exposes only the public members as own keys, most of them non-enumerable', () => {
  const es = createEventSource(unusedUrl);
  es.onerror = () => {};
  expect(Object.keys(es).sort()).toEqual(enumerablePublicMembers.slice().sort());
  expect(Object.getOwnPropertyNames(es).sort()).toEqual(publicMembers.slice().sort());
  expect(Object.getOwnPropertyNames(es).some((key) => key.startsWith('_'))).toBe(false);
  es.close();
});

// The non-enumerable members stay writable and configurable, exactly like a class's own
// instance methods and accessors would have been: only `enumerable` sets them apart from an
// ordinary own property. A caller can reassign `close`, `addEventListener`, or
// `removeEventListener` the same way it could reassign a plain method, and a test's
// `jest.spyOn` can redefine any of the five, the same way it could redefine a plain method.
it('keeps the non-enumerable members writable and configurable', () => {
  const es = createEventSource(unusedUrl);
  es.onerror = () => {};

  ['addEventListener', 'removeEventListener', 'close'].forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(es, key) as PropertyDescriptor;
    expect(descriptor).toMatchObject({ enumerable: false, configurable: true, writable: true });
    expect(typeof descriptor.value).toEqual('function');
  });

  ['readyState', 'url'].forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(es, key) as PropertyDescriptor;
    expect(descriptor).toMatchObject({ enumerable: false, configurable: true });
    expect(typeof descriptor.get).toEqual('function');
  });

  // The unlock this configurability provides: a reassignment compiles and, unlike before this
  // fix, does not throw at runtime either.
  const originalClose = es.close;
  es.close = () => {};
  es.close = originalClose;
  expect(() => jest.spyOn(es, 'close')).not.toThrow();

  es.close();
});

it('can be JSON.stringify-d without throwing when a read timeout is armed', () => {
  // With readTimeoutMillis set, the read-timeout handle is closure state, never an own property
  // of the returned object, so it cannot make JSON.stringify() throw or leak a Node Timeout.
  const es = createEventSource(unusedUrl, {
    headers: { authorization: 'sdk-key-should-not-leak' },
    readTimeoutMillis: 5000,
  });
  es.onerror = () => {};
  let serialized: string | undefined;
  expect(() => {
    serialized = JSON.stringify(es);
  }).not.toThrow();
  expect(serialized).not.toContain(unusedUrl);
  expect(serialized).not.toContain('authorization');
  expect(serialized).not.toContain('sdk-key-should-not-leak');
  expect(Object.keys(es).some((key) => key.startsWith('_'))).toBe(false);
  es.close();
});

it('keeps every internal field out of the public surface after a message and a reconnect', async () => {
  const delayOpts = { initialRetryDelayMillis: 1 };
  await withServer(async (server) => {
    server.byDefault(writeEvents(['data: hello\n\n']));
    await withEventSource(server.url, delayOpts, async (es) => {
      const messages = startMessageQueue(es);
      expect((await messages.take()).data).toEqual('hello');
      await server.closeAndWait();
      await withServerOnPort(server.port, async (reconnected) => {
        reconnected.byDefault(writeEvents(['data: hello again\n\n']));
        expect((await messages.take()).data).toEqual('hello again');
      });
      let serialized: string | undefined;
      expect(() => {
        serialized = JSON.stringify(es);
      }).not.toThrow();
      expect(serialized).toBeDefined();
      expect(Object.keys(es).sort()).toEqual(enumerablePublicMembers.slice().sort());
      expect(Object.getOwnPropertyNames(es).sort()).toEqual(publicMembers.slice().sort());
    });
  });
});
