import { PassThrough, Readable } from 'node:stream';

import {
  createStreamingResponse,
  RawHeaders,
  StreamingResponseSource,
} from '../../../src/internal/fetch/StreamingResponse';

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function makeSource(
  parts: Uint8Array[],
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
          return { done: false, value: parts[index - 1] };
        }
        return { done: true };
      },
    }),
  };
}

function makeTextSource(
  parts: string[],
  meta: { headers?: RawHeaders; statusCode?: number; statusMessage?: string } = {},
): StreamingResponseSource {
  return makeSource(parts.map(utf8), meta);
}

it('exposes the status code and status message', () => {
  const res = createStreamingResponse(
    makeTextSource([], { statusCode: 301, statusMessage: 'Moved Permanently' }),
  );
  expect(res.status).toBe(301);
  expect(res.statusText).toBe('Moved Permanently');
});

it('defaults the status to 0 and the status message to an empty string when absent', () => {
  const res = createStreamingResponse(makeTextSource([]));
  expect(res.status).toBe(0);
  expect(res.statusText).toBe('');
});

it('wraps the raw headers', () => {
  const res = createStreamingResponse(
    makeTextSource([], {
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

it('matches header names without case sensitivity', () => {
  const res = createStreamingResponse(
    makeTextSource([], { headers: { 'Content-Type': 'text/event-stream' }, statusCode: 200 }),
  );
  expect(res.headers.get('content-type')).toBe('text/event-stream');
  expect(res.headers.get('CONTENT-TYPE')).toBe('text/event-stream');
  expect(res.headers.has('Content-Type')).toBe(true);
  expect(Array.from(res.headers.keys())).toEqual(['content-type']);
});

it('reports a header without a value as absent', () => {
  const res = createStreamingResponse(
    makeTextSource([], { headers: { empty: undefined }, statusCode: 200 }),
  );
  expect(res.headers.has('empty')).toBe(false);
  expect(res.headers.get('empty')).toBeNull();
  expect(Array.from(res.headers.keys())).toEqual([]);
});

it('does not report names inherited from the object prototype as headers', () => {
  const res = createStreamingResponse(makeTextSource([], { statusCode: 200 }));
  expect(res.headers.get('constructor')).toBeNull();
  expect(res.headers.get('__proto__')).toBeNull();
  expect(res.headers.has('toString')).toBe(false);
});

it('hands out one chunk per read and then reports done', async () => {
  const res = createStreamingResponse(makeTextSource(['first', 'second']));
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
  const res = createStreamingResponse(makeTextSource(['hello ', 'world']));
  await expect(res.text()).resolves.toBe('hello world');
});

it('decodes a multi-byte character split across chunks', async () => {
  const bytes = utf8('héllo €!');
  const res = createStreamingResponse(
    makeSource([bytes.slice(0, 2), bytes.slice(2, 7), bytes.slice(7)]),
  );
  await expect(res.text()).resolves.toBe('héllo €!');
});

it('parses the remaining stream as JSON', async () => {
  const res = createStreamingResponse(makeTextSource(['{"a":', '1}']));
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

it('releases the stream through the iterator return method on cancel', async () => {
  const returnSpy = jest.fn(async () => ({ done: true }));
  const source: StreamingResponseSource = {
    headers: {},
    [Symbol.asyncIterator]: () => ({
      next: async () => ({ done: false, value: utf8('chunk') }),
      return: returnSpy,
    }),
  };
  const res = createStreamingResponse(source);
  await res.body.getReader().cancel?.();
  await res.body.cancel?.();
  expect(returnSpy).toHaveBeenCalledTimes(2);
});

it('tolerates cancel when the iterator has no return method', async () => {
  const res = createStreamingResponse(makeTextSource(['chunk']));
  await expect(Promise.resolve(res.body.cancel?.())).resolves.toBeUndefined();
});

it('accepts a real Node readable stream as the source', async () => {
  const readable = Readable.from([Buffer.from('data: '), Buffer.from('hello\n\n')]);
  const source: StreamingResponseSource = Object.assign(readable, {
    headers: { 'content-type': 'text/event-stream' },
    statusCode: 200,
    statusMessage: 'OK',
  });
  const res = createStreamingResponse(source);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('text/event-stream');
  await expect(res.text()).resolves.toBe('data: hello\n\n');
});

it('destroys a real Node readable stream when the caller cancels mid-stream', async () => {
  const readable = Readable.from([Buffer.from('first'), Buffer.from('endless')]);
  const source: StreamingResponseSource = Object.assign(readable, { headers: {} });
  const res = createStreamingResponse(source);
  const reader = res.body.getReader();
  await reader.read();
  await reader.cancel?.();
  expect(readable.destroyed).toBe(true);
});

it('destroys a real Node readable stream when the caller cancels with a read in progress', async () => {
  const stalled = new PassThrough();
  const source: StreamingResponseSource = Object.assign(stalled, { headers: {} });
  const res = createStreamingResponse(source);
  const reader = res.body.getReader();
  const pending = reader.read();
  await reader.cancel?.();
  expect(stalled.destroyed).toBe(true);
  await expect(pending).rejects.toThrow('Premature close');
});

it('destroys a real Node readable stream when the caller cancels before reading', async () => {
  const readable = Readable.from([Buffer.from('never read')]);
  const source: StreamingResponseSource = Object.assign(readable, { headers: {} });
  const res = createStreamingResponse(source);
  await res.body.cancel?.();
  expect(readable.destroyed).toBe(true);
});
