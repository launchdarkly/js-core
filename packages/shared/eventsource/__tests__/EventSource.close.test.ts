// launchdarkly-js-test-helpers is a dev dependency and the linter doesn't understand that this
// file is only used by tests.
// eslint-disable-next-line import/no-extraneous-dependencies
import { sleepAsync, TestHttpHandlers } from 'launchdarkly-js-test-helpers';

import { CLOSED, createEventSource, EventSource } from '../src/EventSource';
import { FetchFn, FetchResponse, MessageEvent } from '../src/types';
import { withServer, writeEvents } from './helpers';

afterEach(() => {
  jest.restoreAllMocks();
});

it('does not reopen or retry a connection that close() already closed before fetch() resolved', async () => {
  let resolveFetch: (() => void) | undefined;
  let fetchCallCount = 0;
  jest.spyOn(global, 'fetch').mockImplementation(
    (_url, init) =>
      new Promise<Response>((resolve) => {
        fetchCallCount += 1;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            // Mirrors what a real fetch()'d body does once the request is aborted: any read
            // against it fails.
            init?.signal?.addEventListener('abort', () => {
              controller.error(new Error('aborted'));
            });
          },
        });
        if (fetchCallCount === 1) {
          resolveFetch = () => resolve(new Response(stream, { status: 200 }));
        }
        // A second call would be an unwanted reconnect; left unresolved so a regression fails
        // the call-count assertion below instead of doing real work.
      }),
  );

  const eventLog: string[] = [];
  const es = createEventSource('http://example.test/stream', { initialRetryDelayMillis: 10 });
  ['open', 'closed', 'error', 'retrying', 'message'].forEach((type) => {
    es.addEventListener(type, () => eventLog.push(type));
  });

  // The fetch() promise resolves, but close() runs before the .then() callback that would handle
  // the response gets a chance to run.
  resolveFetch?.();
  es.close();

  await sleepAsync(50);

  expect(eventLog).toEqual(['closed']);
  expect(fetchCallCount).toEqual(1);
});

it('does not deliver a message from a read() that resolved after close() was already called', async () => {
  const encoder = new TextEncoder();
  let resolveSecondRead: ((result: { done: boolean; value?: Uint8Array }) => void) | undefined;
  let readCallCount = 0;
  const reader = {
    read: jest.fn(() => {
      readCallCount += 1;
      if (readCallCount === 1) {
        return Promise.resolve({ done: false, value: encoder.encode('data: first\n\n') });
      }
      return new Promise((resolve) => {
        resolveSecondRead = resolve;
      });
    }),
  };
  const fakeResponse = {
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    body: { getReader: () => reader },
  } as unknown as Response;
  jest.spyOn(global, 'fetch').mockResolvedValueOnce(fakeResponse);

  const messages: string[] = [];
  const es = createEventSource('http://example.test/stream', { initialRetryDelayMillis: 10 });
  es.addEventListener('message', (m: MessageEvent) => messages.push(m.data));

  // Lets the first chunk be read and delivered, which puts a second read() in flight.
  await sleepAsync(20);
  expect(messages).toEqual(['first']);
  expect(readCallCount).toEqual(2);

  // The second read() resolves, but close() runs before the await continuation that would
  // process the chunk gets a chance to run.
  resolveSecondRead?.({ done: false, value: encoder.encode('data: second\n\n') });
  es.close();

  await sleepAsync(50);

  expect(messages).toEqual(['first']);
});

it('does not dispatch an event parsed after a listener calls close()', async () => {
  await withServer(async (server) => {
    // Both blocks arrive in one chunk, so the second is already parsed-ready when the first
    // listener runs.
    server.byDefault(writeEvents(['data: first\n\ndata: second\n\n']));
    const es = createEventSource(server.url, { initialRetryDelayMillis: 1 });
    es.onerror = () => {};
    const received: string[] = [];
    es.addEventListener('message', (m: MessageEvent) => {
      received.push(m.data);
      es.close();
    });
    // close() runs inside the first dispatch; the pause gives any incorrect later dispatch time
    // to surface before the assertion.
    await sleepAsync(100);
    expect(received).toEqual(['first']);
  });
});

it('aborts the request when the error filter declines a retry mid-stream', async () => {
  const encoder = new TextEncoder();
  let reads = 0;
  const reader = {
    read: async (): Promise<{ done: boolean; value?: Uint8Array }> => {
      reads += 1;
      if (reads === 1) {
        return { done: false, value: encoder.encode('data: one\n\n') };
      }
      throw new Error('mid-stream drop');
    },
  };
  const response: FetchResponse = {
    status: 200,
    statusText: 'OK',
    headers: {
      forEach(callback: (value: string, key: string) => void): void {
        callback('text/event-stream', 'content-type');
      },
    },
    body: { getReader: () => reader },
  };
  let aborted = false;
  const injected: FetchFn = (_url, init) => {
    init.signal?.addEventListener('abort', () => {
      aborted = true;
    });
    return Promise.resolve(response);
  };

  const eventLog: string[] = [];
  const es = createEventSource('http://example.test/stream', {
    fetch: injected,
    errorFilter: () => false,
  });
  es.onerror = () => {};
  es.addEventListener('closed', () => eventLog.push('closed'));

  await sleepAsync(50);

  // The non-retry path must release the connection itself: close() is a no-op once the state
  // is CLOSED, so nothing later can abort the transport.
  expect(eventLog).toEqual(['closed']);
  expect(aborted).toBe(true);
});

it('keeps the stream closed when the error filter calls close() and returns true', async () => {
  let fetchCalls = 0;
  const injected: FetchFn = () => {
    fetchCalls += 1;
    return Promise.reject(new Error('connection refused'));
  };
  const closedEvents: string[] = [];
  // The filter body runs only after the first (asynchronous) failure, so the reference to
  // `es` inside it is safe.
  const es: EventSource = createEventSource('http://example.test/stream', {
    fetch: injected,
    initialRetryDelayMillis: 1,
    errorFilter: () => {
      es.close();
      return true;
    },
  });
  es.onerror = () => {};
  es.addEventListener('closed', () => closedEvents.push('closed'));

  await sleepAsync(50);

  // The close inside the filter is final: the retry decision must not bring the state back to
  // CONNECTING or start another attempt.
  expect(es.readyState).toEqual(CLOSED);
  expect(fetchCalls).toEqual(1);
  expect(closedEvents).toEqual(['closed']);
});

it('dispatches closed only once when an error listener calls close() on a non-retryable error', async () => {
  await withServer(async (server) => {
    server.byDefault(TestHttpHandlers.respond(401));
    const es = createEventSource(server.url, { initialRetryDelayMillis: 1 });
    es.onerror = () => {};
    const closedEvents: string[] = [];
    es.addEventListener('closed', () => closedEvents.push('closed'));
    es.addEventListener('error', () => es.close());

    await sleepAsync(100);

    // close() already dispatched `closed`; the non-retry teardown must not dispatch a second.
    expect(closedEvents).toEqual(['closed']);
    expect(es.readyState).toEqual(CLOSED);
  });
});
