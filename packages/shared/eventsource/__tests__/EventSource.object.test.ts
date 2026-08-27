import EventSource from '../src/EventSource';
import {
  deliberatelyUnusedPort,
  waitForOpenEvent,
  startErrorQueue,
  withEventSource,
  withServer,
  writeEvents,
} from './helpers';

const unusedUrl = `http://localhost:${deliberatelyUnusedPort}`;

it('has readyState constants on the constructor', () => {
  expect(EventSource.CONNECTING).toEqual(0);
  expect(EventSource.OPEN).toEqual(1);
  expect(EventSource.CLOSED).toEqual(2);
});

it('has readyState constants on instances', () => {
  const es = new EventSource(unusedUrl);
  es.onerror = () => {};
  expect(es.CONNECTING).toEqual(EventSource.CONNECTING);
  expect(es.OPEN).toEqual(EventSource.OPEN);
  expect(es.CLOSED).toEqual(EventSource.CLOSED);
  es.close();
});

it('is CONNECTING before the connection has been established', () => {
  const es = new EventSource(unusedUrl);
  es.onerror = () => {};
  expect(es.readyState).toEqual(EventSource.CONNECTING);
  es.close();
});

it('is CONNECTING when the server has closed the connection', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([]));
    await withEventSource(server.url, { initialRetryDelayMillis: 10 }, async (es) => {
      const errors = startErrorQueue(es);
      await waitForOpenEvent(es);
      server.close();
      await errors.take();
      expect(es.readyState).toEqual(EventSource.CONNECTING);
    });
  });
});

it('is OPEN when the connection has been established', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([]));
    await withEventSource(server.url, undefined, async (es) => {
      await waitForOpenEvent(es);
      expect(es.readyState).toEqual(EventSource.OPEN);
    });
  });
});

it('is CLOSED after the connection has been closed', async () => {
  await withServer(async (server) => {
    server.byDefault(writeEvents([]));
    await withEventSource(server.url, undefined, async (es) => {
      await waitForOpenEvent(es);
      es.close();
      expect(es.readyState).toEqual(EventSource.CLOSED);
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

it('has close as a prototype method', () => {
  expect(typeof EventSource.prototype.close).toEqual('function');
});

it('exposes the original request url', () => {
  const es = new EventSource(unusedUrl);
  es.onerror = () => {};
  es.close();
  expect(es.url).toEqual(unusedUrl);
});

it('declares support for custom options', () => {
  expect(EventSource.supportedOptions.errorFilter).toBe(true);
  expect(EventSource.supportedOptions.headers).toBe(true);
  expect(EventSource.supportedOptions.https).toBe(true);
  expect(EventSource.supportedOptions.initialRetryDelayMillis).toBe(true);
  expect(EventSource.supportedOptions.jitterRatio).toBe(true);
  expect(EventSource.supportedOptions.maxBackoffMillis).toBe(true);
  expect(EventSource.supportedOptions.method).toBe(true);
  expect(EventSource.supportedOptions.proxy).toBe(true);
  expect(EventSource.supportedOptions.retryResetIntervalMillis).toBe(true);
  expect(EventSource.supportedOptions.skipDefaultHeaders).toBe(true);
  expect(EventSource.supportedOptions.withCredentials).toBe(true);
});

it('does not expose configured headers as an enumerable property', () => {
  const es = new EventSource(unusedUrl, {
    headers: { authorization: 'sdk-key-should-not-leak' },
  });
  es.onerror = () => {};
  expect(JSON.stringify(es)).not.toContain('sdk-key-should-not-leak');
  expect(Object.keys(es)).not.toEqual(
    expect.arrayContaining(['_config', '_req']),
  );
  es.close();
});

it('does not allow supportedOptions to be modified', () => {
  // The original JavaScript suite asserted this by assigning to the property, which silently
  // failed in sloppy mode. Compiled TypeScript is always strict mode, where the same assignment
  // throws, so the property descriptor is checked directly instead.
  expect(Object.getOwnPropertyDescriptor(EventSource.supportedOptions, 'headers')).toEqual({
    value: true,
    writable: false,
    enumerable: true,
    configurable: false,
  });
});
