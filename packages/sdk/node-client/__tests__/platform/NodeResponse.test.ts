import * as http from 'http';
import { Readable } from 'stream';
import * as zlib from 'zlib';

import NodeResponse from '../../src/platform/NodeResponse';

function makeIncomingMessage(
  body: Buffer | string,
  options: { headers?: http.IncomingHttpHeaders; statusCode?: number } = {},
): http.IncomingMessage {
  const stream = Readable.from([body]) as unknown as http.IncomingMessage;
  stream.headers = options.headers ?? {};
  stream.statusCode = 'statusCode' in options ? options.statusCode : 200;
  return stream;
}

it('exposes the status code from the incoming message', () => {
  const res = new NodeResponse(makeIncomingMessage('ok', { statusCode: 201 }));
  expect(res.status).toBe(201);
});

it('defaults the status to 0 when the incoming message has no status code', () => {
  const res = new NodeResponse(makeIncomingMessage('', { statusCode: undefined }));
  expect(res.status).toBe(0);
});

it('wraps response headers in a HeaderWrapper', () => {
  const res = new NodeResponse(
    makeIncomingMessage('', { headers: { 'content-type': 'text/plain' } }),
  );
  expect(res.headers.get('content-type')).toBe('text/plain');
  expect(res.headers.get('missing')).toBeNull();
});

it('reads the body as text', async () => {
  const res = new NodeResponse(makeIncomingMessage('hello world'));
  await expect(res.text()).resolves.toBe('hello world');
});

it('parses the body as JSON', async () => {
  const payload = { greeting: 'hello', count: 2 };
  const res = new NodeResponse(makeIncomingMessage(JSON.stringify(payload)));
  await expect(res.json()).resolves.toEqual(payload);
});

it('decodes a gzip-encoded body', async () => {
  const gzipped = zlib.gzipSync(Buffer.from('compressed payload', 'utf8'));
  const res = new NodeResponse(
    makeIncomingMessage(gzipped, { headers: { 'content-encoding': 'gzip' } }),
  );
  await expect(res.text()).resolves.toBe('compressed payload');
});

it('rejects text() when the pipeline encounters an error', async () => {
  const erroring = new Readable({
    read() {
      this.destroy(new Error('boom'));
    },
  }) as unknown as http.IncomingMessage;
  erroring.headers = {};
  erroring.statusCode = 500;

  const res = new NodeResponse(erroring);
  await expect(res.text()).rejects.toThrow('boom');
});
