// launchdarkly-js-test-helpers is a dev dependency and the linter doesn't understand that this
// file is only used by tests.
// eslint-disable-next-line import/no-extraneous-dependencies
import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { createEventSource } from '../src/EventSource';
import {
  ErrorEvent,
  EventSourceInitDict,
  FetchFn,
  FetchRequestInit,
  FetchResponse,
  MessageEvent,
} from '../src/types';
import {
  deliberatelyUnusedPort,
  startMessageQueue,
  waitForOpenEvent,
  withEventSource,
  withServer,
  writeEvents,
} from './helpers';

/**
 * A canned response whose body hands out the given chunks and then stays pending forever, like an
 * idle SSE connection. The shape matches what the Node SDK http/https adapters produce.
 */
function idleStreamResponse(chunks: string[]): FetchResponse {
  const encoder = new TextEncoder();
  const pending = [...chunks];
  return {
    status: 200,
    statusText: 'OK',
    headers: {
      forEach(callback: (value: string, key: string) => void): void {
        callback('text/event-stream', 'content-type');
      },
    },
    body: {
      getReader: () => ({
        read: async (): Promise<{ done: boolean; value?: Uint8Array }> => {
          const next = pending.shift();
          if (next !== undefined) {
            return { done: false, value: encoder.encode(next) };
          }
          return new Promise<never>(() => {});
        },
      }),
    },
  };
}

it('accepts the global fetch as a FetchFn without casts', () => {
  // This is a compile-time assertion: the assignment fails to build if the structural fetch
  // types drift away from the real fetch API.
  const compatible: FetchFn = fetch;
  expect(typeof compatible).toEqual('function');
});

it('uses the global fetch when the fetch option is absent', async () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  try {
    await withServer(async (server) => {
      server.byDefault(writeEvents(['data: hello\n\n']));
      await withEventSource(server.url, undefined, async (es) => {
        await waitForOpenEvent(es);
        expect(fetchSpy).toHaveBeenCalledWith(
          server.url,
          expect.objectContaining({ method: 'GET' }),
        );
      });
    });
  } finally {
    fetchSpy.mockRestore();
  }
});

it('passes the url, method, headers, body, and signal to an injected fetch', () => {
  const injected = jest.fn<Promise<FetchResponse>, [string, FetchRequestInit]>(
    () => new Promise<never>(() => {}),
  );
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const options: Partial<EventSourceInitDict> = {
    fetch: injected,
    method: 'REPORT',
    body: '{"kind":"user"}',
    headers: { authorization: 'sdk-key' },
  };
  const es = createEventSource(url, options);
  expect(injected).toHaveBeenCalledTimes(1);
  const [calledUrl, init] = injected.mock.calls[0];
  expect(calledUrl).toEqual(url);
  expect(init.method).toEqual('REPORT');
  expect(init.body).toEqual('{"kind":"user"}');
  expect(init.headers).toMatchObject({
    authorization: 'sdk-key',
    'Cache-Control': 'no-cache',
    Accept: 'text/event-stream',
  });
  expect(init.signal?.aborted).toBe(false);
  es.close();
  expect(init.signal?.aborted).toBe(true);
});

it('parses events that stream through an injected fetch', async () => {
  const injected: FetchFn = async () =>
    idleStreamResponse(['event: put\ndata: {"flag":true}\n\n', 'data: plain\n\n']);
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const es = createEventSource(url, { fetch: injected });
  es.onerror = () => {};
  try {
    const messages = startMessageQueue(es);
    const putEvents = new AsyncQueue<MessageEvent>();
    es.addEventListener('put', (event) => putEvents.add(event));
    await waitForOpenEvent(es);
    const put = await putEvents.take();
    expect(put.data).toEqual('{"flag":true}');
    const plain = await messages.take();
    expect(plain.data).toEqual('plain');
  } finally {
    es.close();
  }
});

it('reports a non-200 response from an injected fetch as an error', async () => {
  const injected: FetchFn = async () => ({
    status: 401,
    statusText: 'Unauthorized',
    headers: { forEach: () => {} },
    body: null,
  });
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const errors = new AsyncQueue<ErrorEvent | undefined>();
  const es = createEventSource(url, { fetch: injected, errorFilter: () => false });
  es.onerror = (e) => errors.add(e);
  try {
    const err = await errors.take();
    expect(err?.status).toEqual(401);
  } finally {
    es.close();
  }
});
