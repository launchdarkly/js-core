import * as http from 'http';
import { Readable } from 'stream';

import ElectronStreamingResponse from '../../src/platform/ElectronStreamingResponse';

function makeIncomingMessage(
  chunks: Buffer[],
  options: {
    headers?: http.IncomingHttpHeaders;
    statusCode?: number;
    statusMessage?: string;
  } = {},
): http.IncomingMessage {
  const stream = Readable.from(chunks) as unknown as http.IncomingMessage;
  stream.headers = options.headers ?? {};
  stream.statusCode = 'statusCode' in options ? options.statusCode : 200;
  if (options.statusMessage !== undefined) {
    stream.statusMessage = options.statusMessage;
  }
  return stream;
}

it('exposes the status code and status message', () => {
  const res = new ElectronStreamingResponse(
    makeIncomingMessage([], { statusCode: 301, statusMessage: 'Moved Permanently' }),
  );
  expect(res.status).toBe(301);
  expect(res.statusText).toBe('Moved Permanently');
});

it('defaults the status to 0 and the status message to an empty string when absent', () => {
  const res = new ElectronStreamingResponse(makeIncomingMessage([], { statusCode: undefined }));
  expect(res.status).toBe(0);
  expect(res.statusText).toBe('');
});

it('wraps the response headers in a HeaderWrapper', () => {
  const res = new ElectronStreamingResponse(
    makeIncomingMessage([], { headers: { 'content-type': 'text/event-stream' } }),
  );
  expect(res.headers.get('content-type')).toBe('text/event-stream');
});

it('hands out one chunk per read and then reports done', async () => {
  const res = new ElectronStreamingResponse(
    makeIncomingMessage([Buffer.from('first'), Buffer.from('second')]),
  );
  const reader = res.body.getReader();
  const first = await reader.read();
  expect(first.done).toBe(false);
  expect(Buffer.from(first.value ?? []).toString()).toBe('first');
  const second = await reader.read();
  expect(Buffer.from(second.value ?? []).toString()).toBe('second');
  const end = await reader.read();
  expect(end.done).toBe(true);
});

it('reads the remaining stream as text', async () => {
  const res = new ElectronStreamingResponse(
    makeIncomingMessage([Buffer.from('hello '), Buffer.from('world')]),
  );
  await expect(res.text()).resolves.toBe('hello world');
});

it('parses the remaining stream as JSON', async () => {
  const res = new ElectronStreamingResponse(makeIncomingMessage([Buffer.from('{"a":1}')]));
  await expect(res.json()).resolves.toEqual({ a: 1 });
});

it('rejects a pending read when the stream errors', async () => {
  const erroring = new Readable({
    read() {
      this.destroy(new Error('boom'));
    },
  }) as unknown as http.IncomingMessage;
  erroring.headers = {};
  erroring.statusCode = 200;
  const res = new ElectronStreamingResponse(erroring);
  await expect(res.body.getReader().read()).rejects.toThrow('boom');
});
