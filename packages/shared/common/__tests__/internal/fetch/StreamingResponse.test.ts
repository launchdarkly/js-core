import {
  createStreamingResponse,
  RawHeaders,
  StreamingResponseSource,
} from '../../../src/internal/fetch/StreamingResponse';

function utf8(text: string): Uint8Array {
  return new Uint8Array(text.split('').map((char) => char.charCodeAt(0)));
}

function makeSource(
  parts: string[],
  meta: { headers?: RawHeaders; statusCode?: number; statusMessage?: string } = {},
): StreamingResponseSource {
  let index = 0;
  return {
    headers: meta.headers ?? {},
    statusCode: meta.statusCode,
    statusMessage: meta.statusMessage,
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        if (index < parts.length) {
          index += 1;
          return { done: false, value: utf8(parts[index - 1]) };
        }
        return { done: true };
      },
    }),
  };
}

it('exposes the status code and status message', () => {
  const res = createStreamingResponse(
    makeSource([], { statusCode: 301, statusMessage: 'Moved Permanently' }),
  );
  expect(res.status).toBe(301);
  expect(res.statusText).toBe('Moved Permanently');
});

it('defaults the status to 0 and the status message to an empty string when absent', () => {
  const res = createStreamingResponse(makeSource([]));
  expect(res.status).toBe(0);
  expect(res.statusText).toBe('');
});

it('wraps the raw headers', () => {
  const res = createStreamingResponse(
    makeSource([], {
      headers: {
        'content-type': 'text/event-stream',
        'set-cookie': ['a=1', 'b=2'],
        empty: undefined,
      },
      statusCode: 200,
    }),
  );
  expect(res.headers.get('content-type')).toBe('text/event-stream');
  expect(res.headers.get('set-cookie')).toBe('a=1, b=2');
  expect(res.headers.get('missing')).toBeNull();
  expect(res.headers.has('content-type')).toBe(true);
  expect(res.headers.has('missing')).toBe(false);
  expect(Array.from(res.headers.entries())).toEqual([
    ['content-type', 'text/event-stream'],
    ['set-cookie', 'a=1, b=2'],
  ]);
  const visited: [string, string][] = [];
  res.headers.forEach?.((value, key) => visited.push([key, value]));
  expect(visited).toEqual([
    ['content-type', 'text/event-stream'],
    ['set-cookie', 'a=1, b=2'],
  ]);
});

it('hands out one chunk per read and then reports done', async () => {
  const res = createStreamingResponse(makeSource(['first', 'second']));
  const reader = res.body.getReader();
  const first = await reader.read();
  expect(first.done).toBe(false);
  expect(first.value).toEqual(utf8('first'));
  const second = await reader.read();
  expect(second.value).toEqual(utf8('second'));
  const end = await reader.read();
  expect(end.done).toBe(true);
});

it('reads the remaining stream as text', async () => {
  const res = createStreamingResponse(makeSource(['hello ', 'world']));
  await expect(res.text()).resolves.toBe('hello world');
});

it('parses the remaining stream as JSON', async () => {
  const res = createStreamingResponse(makeSource(['{"a":', '1}']));
  await expect(res.json()).resolves.toEqual({ a: 1 });
});

it('rejects a pending read when the stream errors', async () => {
  const erroring: StreamingResponseSource = {
    headers: {},
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        throw new Error('boom');
      },
    }),
  };
  const res = createStreamingResponse(erroring);
  await expect(res.body.getReader().read()).rejects.toThrow('boom');
});
