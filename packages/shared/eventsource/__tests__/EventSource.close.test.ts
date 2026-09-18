// launchdarkly-js-test-helpers is a dev dependency and the linter doesn't understand that this
// file is only used by tests.
// eslint-disable-next-line import/no-extraneous-dependencies
import { sleepAsync } from 'launchdarkly-js-test-helpers';

import { createEventSource } from '../src/EventSource';
import { MessageEvent } from '../src/types';

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
