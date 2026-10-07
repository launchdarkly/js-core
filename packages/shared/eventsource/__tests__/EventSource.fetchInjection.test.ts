// launchdarkly-js-test-helpers is a dev dependency and the linter doesn't understand that this
// file is only used by tests.
// eslint-disable-next-line import/no-extraneous-dependencies
import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { createEventSource } from '../src/EventSource';
import {
  ErrorEvent,
  EventSourceInitDict,
  FetchLike,
  FetchHeaders,
  FetchLikeOptions,
  FetchLikeResponse,
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
function idleStreamResponse(chunks: string[], headers?: FetchHeaders): FetchLikeResponse {
  const encoder = new TextEncoder();
  const pending = [...chunks];
  return {
    status: 200,
    statusText: 'OK',
    headers: headers ?? {
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

it('accepts the global fetch as a FetchLike without casts', () => {
  // This is a compile-time assertion: the assignment fails to build if the structural fetch
  // types drift away from the real fetch API.
  const compatible: FetchLike = fetch;
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
  const injected = jest.fn<Promise<FetchLikeResponse>, [string, FetchLikeOptions]>(
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

it('replaces a default header when the caller overrides it with a different case', () => {
  const injected = jest.fn<Promise<FetchLikeResponse>, [string, FetchLikeOptions]>(
    () => new Promise<never>(() => {}),
  );
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const es = createEventSource(url, { fetch: injected, headers: { accept: 'application/json' } });
  const [, init] = injected.mock.calls[0];
  expect(init.headers).toEqual({
    'Cache-Control': 'no-cache',
    accept: 'application/json',
  });
  es.close();
});

it('connects with a relative url and reports an empty origin', async () => {
  // With no document location to resolve against, a relative url cannot produce an origin, but
  // it must not throw either: the injected transport decides what to do with it.
  const injected: FetchLike = async () => idleStreamResponse(['data: hello\n\n']);
  const es = createEventSource('/relative/stream', { fetch: injected });
  es.onerror = () => {};
  try {
    const messages = startMessageQueue(es);
    const m = await messages.take();
    expect(m.data).toEqual('hello');
    expect(m.origin).toEqual('');
  } finally {
    es.close();
  }
});

it('reports the origin of the final response url when the transport supplies one', async () => {
  const injected: FetchLike = async () => ({
    ...idleStreamResponse(['data: hello\n\n']),
    url: 'https://redirected.example.com/other/stream',
  });
  const es = createEventSource(`http://localhost:${deliberatelyUnusedPort}/stream`, {
    fetch: injected,
  });
  es.onerror = () => {};
  try {
    const messages = startMessageQueue(es);
    const m = await messages.take();
    expect(m.origin).toEqual('https://redirected.example.com');
  } finally {
    es.close();
  }
});

it('parses events that stream through an injected fetch', async () => {
  const injected: FetchLike = async () =>
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
  const injected: FetchLike = async () => ({
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

it('accepts a response whose transport supplies no headers at all', async () => {
  const injected: FetchLike = async () => idleStreamResponse(['data: hello\n\n'], { forEach() {} });
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const es = createEventSource(url, { fetch: injected });
  es.onerror = () => {};
  try {
    const messages = startMessageQueue(es);
    expect((await messages.take()).data).toEqual('hello');
  } finally {
    es.close();
  }
});

it('aborts the request when a 200 response has no body', async () => {
  let signal: AbortSignal | undefined;
  const injected: FetchLike = async (_url, init) => {
    signal = init.signal;
    return {
      status: 200,
      statusText: 'OK',
      headers: { forEach: () => {} },
      body: null,
    };
  };
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const es = createEventSource(url, { fetch: injected, errorFilter: () => false });
  es.onerror = () => {};
  try {
    const closed = new AsyncQueue<unknown>();
    es.addEventListener('closed', (e) => closed.add(e));
    await closed.take();
    expect(signal?.aborted).toBe(true);
  } finally {
    es.close();
  }
});

it('folds response header names to lowercase for a transport that reports wire case', async () => {
  // A standard Headers object reports lowercase names; a raw-header transport reports the wire
  // case. Consumers look headers up by lowercase name, so both must produce the same shape.
  const injected: FetchLike = async () =>
    idleStreamResponse(['data: hello\n\n'], {
      forEach(callback: (value: string, key: string) => void): void {
        callback('text/event-stream', 'Content-Type');
        callback('abc', 'X-LD-EnvId');
      },
    });
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const es = createEventSource(url, { fetch: injected });
  es.onerror = () => {};
  try {
    const open = await waitForOpenEvent(es);
    expect(open.headers?.['x-ld-envid']).toEqual('abc');
    expect(open.headers?.['content-type']).toEqual('text/event-stream');
  } finally {
    es.close();
  }
});

it('cancels the body reader on close for a transport that ignores the abort signal', async () => {
  const encoder = new TextEncoder();
  const cancel = jest.fn();
  // This transport never looks at init.signal, which FetchLikeOptions permits. Only the reader
  // cancel can release its connection.
  const injected: FetchLike = async () => ({
    status: 200,
    statusText: 'OK',
    headers: {
      forEach(callback: (value: string, key: string) => void): void {
        callback('text/event-stream', 'content-type');
      },
    },
    body: {
      getReader: () => {
        let delivered = false;
        return {
          read: async (): Promise<{ done: boolean; value?: Uint8Array }> => {
            if (!delivered) {
              delivered = true;
              return { done: false, value: encoder.encode('data: one\n\n') };
            }
            return new Promise<never>(() => {});
          },
          cancel,
        };
      },
    },
  });
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const es = createEventSource(url, { fetch: injected });
  es.onerror = () => {};
  const messages = startMessageQueue(es);
  await messages.take();
  es.close();
  expect(cancel).toHaveBeenCalledTimes(1);
});

it('yields to timers while a transport resolves reads synchronously', async () => {
  const encoder = new TextEncoder();
  let reads = 0;
  let doneReached = false;
  let timerBeforeDone = false;
  // Every read resolves at once with an SSE comment line, so the read loop never waits on I/O.
  // The reads are bounded so a regression of the yield fails the ordering assertion below
  // instead of starving jest's own timers and wedging the run.
  const injected: FetchLike = async () => ({
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
          reads += 1;
          if (reads > 5000) {
            doneReached = true;
            return { done: true };
          }
          return { done: false, value: encoder.encode(': tick\n') };
        },
      }),
    },
  });
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const es = createEventSource(url, { fetch: injected, initialRetryDelayMillis: 60000 });
  es.onerror = () => {};
  try {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        timerBeforeDone = !doneReached;
        resolve();
      }, 0);
    });
    // With the periodic yield, this timer runs at the first yield, long before the 5000
    // synchronous reads finish. Without it, every read completes on the microtask queue first.
    expect(timerBeforeDone).toBe(true);
  } finally {
    es.close();
  }
}, 10000);

it('treats a stream of empty chunks as dead when the read timeout elapses', async () => {
  // Empty chunks are not proof of liveness. Each read resolves after a short real delay, so the
  // loop does not spin, and only the read-timeout timer can report the dead connection.
  const injected: FetchLike = async () => ({
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
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 1);
          });
          return { done: false, value: new Uint8Array(0) };
        },
      }),
    },
  });
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const errors = new AsyncQueue<ErrorEvent | undefined>();
  const es = createEventSource(url, {
    fetch: injected,
    readTimeoutMillis: 30,
    initialRetryDelayMillis: 60000,
  });
  es.onerror = (e) => errors.add(e);
  try {
    const raced = await Promise.race<ErrorEvent | undefined | 'no-timeout'>([
      errors.take(),
      new Promise<'no-timeout'>((resolve) => {
        setTimeout(() => resolve('no-timeout'), 1000);
      }),
    ]);
    expect(raced).not.toEqual('no-timeout');
    expect((raced as ErrorEvent)?.message).toContain('Read timeout');
  } finally {
    es.close();
  }
}, 10000);

it('does not create a reader when onopen closes the stream', async () => {
  const getReader = jest.fn();
  const bodyCancel = jest.fn();
  // The transport ignores the abort signal, so only an explicit release frees the body.
  const injected: FetchLike = async () => ({
    status: 200,
    statusText: 'OK',
    headers: {
      forEach(callback: (value: string, key: string) => void): void {
        callback('text/event-stream', 'content-type');
      },
    },
    body: { getReader, cancel: bodyCancel },
  });
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const es = createEventSource(url, { fetch: injected });
  es.onerror = () => {};
  const closed = new AsyncQueue<unknown>();
  es.addEventListener('closed', (e) => closed.add(e));
  es.onopen = () => es.close();
  try {
    await closed.take();
    expect(getReader).not.toHaveBeenCalled();
    expect(bodyCancel).toHaveBeenCalledTimes(1);
  } finally {
    es.close();
  }
});

it('releases the unread body of a rejected response', async () => {
  const bodyCancel = jest.fn();
  const scenarios: FetchLikeResponse[] = [
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { forEach: () => {} },
      body: { getReader: () => ({ read: () => new Promise<never>(() => {}) }), cancel: bodyCancel },
    },
    {
      status: 200,
      statusText: 'OK',
      headers: {
        forEach(callback: (value: string, key: string) => void): void {
          callback('text/html', 'content-type');
        },
      },
      body: { getReader: () => ({ read: () => new Promise<never>(() => {}) }), cancel: bodyCancel },
    },
  ];
  let attempt = 0;
  const injected: FetchLike = async () => {
    const res = scenarios[attempt];
    attempt += 1;
    return res;
  };
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const errors = new AsyncQueue<ErrorEvent | undefined>();
  const es = createEventSource(url, { fetch: injected, initialRetryDelayMillis: 1 });
  es.onerror = (e) => errors.add(e);
  try {
    // One rejected non-200 response, then one rejected wrong-content-type response. Both paths
    // reject the response without reading it and must release the body.
    await errors.take();
    await errors.take();
    expect(bodyCancel).toHaveBeenCalledTimes(2);
  } finally {
    es.close();
  }
});

it('delivers chunks a transport supplies as ArrayBuffer', async () => {
  // The read contract declares Uint8Array, but TextDecoder also accepts a raw ArrayBuffer, and
  // a lenient transport can supply one. Such a chunk must count as data, not as emptiness.
  const encoder = new TextEncoder();
  let delivered = false;
  const injected: FetchLike = async () => ({
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
          if (!delivered) {
            delivered = true;
            return {
              done: false,
              value: encoder.encode('data: ab\n\n').buffer as unknown as Uint8Array,
            };
          }
          return new Promise<never>(() => {});
        },
      }),
    },
  });
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const es = createEventSource(url, { fetch: injected });
  es.onerror = () => {};
  try {
    const messages = startMessageQueue(es);
    const result = await Promise.race<MessageEvent | 'none'>([
      messages.take(),
      new Promise<'none'>((resolve) => {
        setTimeout(() => resolve('none'), 1000);
      }),
    ]);
    expect(result).not.toEqual('none');
    expect((result as MessageEvent).data).toEqual('ab');
  } finally {
    es.close();
  }
});

it('releases the request when getReader throws', async () => {
  const bodyCancel = jest.fn();
  let signal: AbortSignal | undefined;
  const injected: FetchLike = async (_url, init) => {
    signal = init.signal;
    return {
      status: 200,
      statusText: 'OK',
      headers: {
        forEach(callback: (value: string, key: string) => void): void {
          callback('text/event-stream', 'content-type');
        },
      },
      body: {
        getReader: () => {
          throw new Error('stream locked');
        },
        cancel: bodyCancel,
      },
    };
  };
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const errors = new AsyncQueue<ErrorEvent | undefined>();
  const es = createEventSource(url, { fetch: injected, initialRetryDelayMillis: 60000 });
  es.onerror = (e) => errors.add(e);
  try {
    const err = await errors.take();
    expect(err?.message).toEqual('stream locked');
    // The reconnect is a minute away. The failure must release the request now, like every
    // other rejection of the response.
    expect(signal?.aborted).toBe(true);
    expect(bodyCancel).toHaveBeenCalledTimes(1);
  } finally {
    es.close();
  }
});

it('close() tolerates a reader cancel that throws synchronously', async () => {
  const encoder = new TextEncoder();
  const injected: FetchLike = async () => ({
    status: 200,
    statusText: 'OK',
    headers: {
      forEach(callback: (value: string, key: string) => void): void {
        callback('text/event-stream', 'content-type');
      },
    },
    body: {
      getReader: () => {
        let delivered = false;
        return {
          read: async (): Promise<{ done: boolean; value?: Uint8Array }> => {
            if (!delivered) {
              delivered = true;
              return { done: false, value: encoder.encode('data: one\n\n') };
            }
            return new Promise<never>(() => {});
          },
          cancel: () => {
            throw new Error('cancel boom');
          },
        };
      },
    },
  });
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const es = createEventSource(url, { fetch: injected });
  es.onerror = () => {};
  const closed = new AsyncQueue<unknown>();
  es.addEventListener('closed', (e) => closed.add(e));
  const messages = startMessageQueue(es);
  await messages.take();
  expect(() => es.close()).not.toThrow();
  await closed.take();
});

it('aborts the failed request when a retried read error schedules a reconnect', async () => {
  const encoder = new TextEncoder();
  const cancel = jest.fn();
  let signal: AbortSignal | undefined;
  const injected: FetchLike = async (_url, init) => {
    signal = init.signal;
    let delivered = false;
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
            if (!delivered) {
              delivered = true;
              return { done: false, value: encoder.encode('data: one\n\n') };
            }
            throw new Error('connection reset');
          },
          cancel,
        }),
      },
    };
  };
  const url = `http://localhost:${deliberatelyUnusedPort}/stream`;
  const errors = new AsyncQueue<ErrorEvent | undefined>();
  const es = createEventSource(url, { fetch: injected, initialRetryDelayMillis: 60000 });
  es.onerror = (e) => errors.add(e);
  try {
    const err = await errors.take();
    expect(err?.message).toEqual('connection reset');
    // The reconnect is a minute away. The failure itself must abort the broken request and
    // cancel the reader, so the connection does not stay held for the whole wait.
    expect(signal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
  } finally {
    es.close();
  }
});

it('recomputes the message origin when urlBuilder picks a new origin for a reconnect', async () => {
  const encoder = new TextEncoder();
  // Like idleStreamResponse, but the body ends after its chunks, so the stream terminates
  // and the client schedules a reconnect.
  const endingStreamResponse = (chunks: string[]): FetchLikeResponse => {
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
            return { done: true };
          },
        }),
      },
    };
  };
  let attempt = 0;
  const injected: FetchLike = async (url) =>
    url.startsWith('http://first.example.com')
      ? endingStreamResponse(['data: one\n\n'])
      : idleStreamResponse(['data: two\n\n']);
  const es = createEventSource('http://original.example.com/stream', {
    fetch: injected,
    initialRetryDelayMillis: 1,
    urlBuilder: () => {
      attempt += 1;
      return attempt === 1 ? 'http://first.example.com/stream' : 'http://second.example.com/stream';
    },
  });
  es.onerror = () => {};
  try {
    const messages = startMessageQueue(es);
    expect((await messages.take()).origin).toEqual('http://first.example.com');
    expect((await messages.take()).origin).toEqual('http://second.example.com');
  } finally {
    es.close();
  }
});
