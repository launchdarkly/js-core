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

it('joins the values of header names that differ only by case', () => {
  const res = createStreamingResponse(
    makeTextSource([], {
      headers: { 'Content-Type': 'text/html', 'content-type': 'text/event-stream' },
      statusCode: 200,
    }),
  );
  expect(res.headers.get('content-type')).toBe('text/html, text/event-stream');
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

it('decodes ArrayBuffer and DataView chunks in text', async () => {
  const bytes = utf8('buffer view');
  const asBuffer = bytes.slice(0, 7).buffer as unknown as Uint8Array;
  const tail = bytes.slice(7);
  const asView = new DataView(
    tail.buffer,
    tail.byteOffset,
    tail.byteLength,
  ) as unknown as Uint8Array;
  const res = createStreamingResponse(makeSource([asBuffer, asView]));
  await expect(res.text()).resolves.toBe('buffer view');
});

it('rejects a string chunk in text instead of corrupting the result', async () => {
  const res = createStreamingResponse(makeSource(['data: hi\n\n' as unknown as Uint8Array]));
  const err = await res.text().then(
    () => undefined,
    (e) => e,
  );
  expect(err).toBeInstanceOf(TypeError);
  expect(String(err)).toContain('BufferSource');
  // The chunk contents must never leak into the error message.
  expect(String(err)).not.toContain('data: hi');
});

it('destroys the source when text rejects a bad chunk', async () => {
  // Readable.from on strings yields string chunks, which the decoder rejects. The
  // rejection must release the connection, because text() owns the body.
  const readable = Readable.from(['data: hi\n\n']);
  const source: StreamingResponseSource = Object.assign(readable, { headers: {} });
  const res = createStreamingResponse(source);
  await expect(res.text()).rejects.toThrow('BufferSource');
  expect(readable.destroyed).toBe(true);
});

it('keeps the fixed message when the source destroy throws during a bad-chunk release', async () => {
  // The release calls inside cancel are guarded. A hostile destroy must not replace the
  // fixed BufferSource message, and the iterator return must still run.
  const destroySpy = jest.fn(() => {
    throw new Error('destroy boom');
  });
  const returnSpy = jest.fn(async () => ({ done: true }));
  const source: StreamingResponseSource = {
    headers: {},
    destroy: destroySpy,
    [Symbol.asyncIterator]: () => ({
      next: async () => ({ done: false, value: 'data: hi\n\n' as unknown as Uint8Array }),
      return: returnSpy,
    }),
  };
  const res = createStreamingResponse(source);
  await expect(res.text()).rejects.toThrow('BufferSource');
  expect(destroySpy).toHaveBeenCalledTimes(1);
  expect(returnSpy).toHaveBeenCalledTimes(1);
});

it('throws a named error when the source has no async iterator', () => {
  const source = { headers: {} } as unknown as StreamingResponseSource;
  expect(() => createStreamingResponse(source)).toThrow(
    'the streaming response source does not provide an async iterator',
  );
});

it('releases the source when a read fails during text', async () => {
  const destroySpy = jest.fn();
  const returnSpy = jest.fn(async () => ({ done: true }));
  const source: StreamingResponseSource = {
    headers: {},
    destroy: destroySpy,
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        throw new Error('connection reset');
      },
      return: returnSpy,
    }),
  };
  const res = createStreamingResponse(source);
  await expect(res.text()).rejects.toThrow('connection reset');
  expect(destroySpy).toHaveBeenCalledTimes(1);
  expect(returnSpy).toHaveBeenCalledTimes(1);
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

it('still releases the iterator when destroy throws', async () => {
  const returnSpy = jest.fn(async () => ({ done: true }));
  const source: StreamingResponseSource = {
    headers: {},
    destroy: () => {
      throw new Error('destroy boom');
    },
    [Symbol.asyncIterator]: () => ({
      next: async () => ({ done: false, value: utf8('chunk') }),
      return: returnSpy,
    }),
  };
  const res = createStreamingResponse(source);
  await expect(Promise.resolve(res.body.cancel?.())).resolves.toBeUndefined();
  expect(returnSpy).toHaveBeenCalledTimes(1);
});

it('tolerates an iterator whose return resolves synchronously', async () => {
  const destroySpy = jest.fn();
  const source: StreamingResponseSource = {
    headers: {},
    destroy: destroySpy,
    [Symbol.asyncIterator]: () => ({
      next: async () => ({ done: false, value: utf8('chunk') }),
      // @ts-ignore deliberately violates the declared Promise-returning shape.
      return: () => ({ done: true }),
    }),
  };
  const res = createStreamingResponse(source);
  await expect(Promise.resolve(res.body.cancel?.())).resolves.toBeUndefined();
  expect(destroySpy).toHaveBeenCalledTimes(1);
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
