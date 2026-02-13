import * as http from 'http';
import * as zlib from 'zlib';

import ElectronRequests from '../../src/platform/ElectronRequests';

const PORT = '3333';
const TEXT_RESPONSE = 'Test Text';
const JSON_RESPONSE = '{"text": "value"}';

interface TestRequestData {
  body: string | Buffer;
  method: string | undefined;
  headers: http.IncomingHttpHeaders;
}

let resolve: (value: TestRequestData | PromiseLike<TestRequestData>) => void;
let promise: Promise<TestRequestData>;
let server: http.Server;
let resetResolve: () => void;
let resetPromise: Promise<void>;

beforeEach(() => {
  resetPromise = new Promise((res) => {
    resetResolve = res;
  });

  promise = new Promise<TestRequestData>((res) => {
    resolve = res;
  });
  server = http.createServer({ keepAlive: false }, (req, res) => {
    const chunks: any[] = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve({
        method: req.method,
        body:
          req.headers['content-encoding'] === 'gzip'
            ? Buffer.concat(chunks)
            : Buffer.concat(chunks).toString(),
        headers: req.headers,
      });
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Connection', 'close');
    if ((req.url?.indexOf('json') || -1) >= 0) {
      res.end(JSON_RESPONSE);
    } else if ((req.url?.indexOf('interrupt') || -1) >= 0) {
      res.destroy();
    } else if ((req.url?.indexOf('404') || -1) >= 0) {
      res.statusCode = 404;
      res.end();
    } else if ((req.url?.indexOf('reset') || -1) >= 0) {
      res.statusCode = 200;
      res.flushHeaders();
      res.write('potato');
      setTimeout(() => {
        res.destroy();
        resetResolve();
      }, 0);
    } else if ((req.url?.indexOf('gzip') || -1) >= 0) {
      res.setHeader('Content-Encoding', 'gzip');
      res.end(zlib.gzipSync(Buffer.from(JSON_RESPONSE, 'utf8')));
    } else {
      res.end(TEXT_RESPONSE);
    }
  });
  server.listen(PORT);
});

afterEach(
  async () =>
    new Promise((resolveClose) => {
      server.close(resolveClose);
    }),
);

describe('given a default instance of NodeRequests', () => {
  const requests = new ElectronRequests();
  it('can make a basic get request', async () => {
    const res = await requests.fetch(`http://localhost:${PORT}`);
    expect(res.headers.get('content-type')).toEqual('text/plain');
    expect(res.status).toEqual(200);
    const text = await res.text();
    expect(text).toEqual(TEXT_RESPONSE);
    const serverResult = await promise;
    expect(serverResult.method).toEqual('GET');
    expect(serverResult.body).toEqual('');
  });

  it('can get json from a response', async () => {
    const res = await requests.fetch(`http://localhost:${PORT}/json`);
    expect(res.headers.get('content-type')).toEqual('text/plain');
    const json = await res.json();
    expect(json).toEqual({ text: 'value' });
    const serverResult = await promise;
    expect(serverResult.method).toEqual('GET');
    expect(serverResult.body).toEqual('');
  });

  it('can handle errors establishing a connection', async () =>
    expect(async () => requests.fetch(`http://badurl:${PORT}/json`)).rejects.toThrow());

  it('can handle handle errors after a connection is established', async () =>
    expect(async () => requests.fetch(`http://localhost:${PORT}/interrupt`)).rejects.toThrow());

  it('can handle status codes', async () => {
    const res = await requests.fetch(`http://localhost:${PORT}/404`);
    expect(res.headers.get('content-type')).toEqual('text/plain');
    expect(res.status).toEqual(404);

    const serverResult = await promise;
    expect(serverResult.method).toEqual('GET');
    expect(serverResult.body).toEqual('');
  });

  it('can make a basic post', async () => {
    await requests.fetch(`http://localhost:${PORT}`, { method: 'POST', body: 'BODY TEXT' });
    const serverResult = await promise;
    expect(serverResult.method).toEqual('POST');
    expect(serverResult.body).toEqual('BODY TEXT');
  });

  it('can make a basic post ignoring compressBodyIfPossible', async () => {
    await requests.fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      body: 'BODY TEXT',
      compressBodyIfPossible: true,
    });
    const serverResult = await promise;
    expect(serverResult.method).toEqual('POST');
    expect(serverResult.body).toEqual('BODY TEXT');
  });

  it('can make a request with headers', async () => {
    await requests.fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      body: 'BODY TEXT',
      headers: {
        'Sample-Header': 'Some header value',
      },
    });
    const serverResult = await promise;
    expect(serverResult.method).toEqual('POST');
    expect(serverResult.body).toEqual('BODY TEXT');
    expect(serverResult.headers['sample-header']).toEqual('Some header value');
  });

  it('rejection is handled for response even if not awaited', async () => {
    const res = await requests.fetch(`http://localhost:${PORT}/reset`);
    expect(res.status).toEqual(200);
    await resetPromise;
  });

  it('rejection is propagated with json promise', async () => {
    const res = await requests.fetch(`http://localhost:${PORT}/reset`);
    expect(res.status).toEqual(200);

    await expect(async () => {
      await res.json();
    }).rejects.toThrow();
  });

  it('includes accept-encoding header', async () => {
    await requests.fetch(`http://localhost:${PORT}/gzip`, { method: 'GET' });
    const serverResult = await promise;
    expect(serverResult.method).toEqual('GET');
    expect(serverResult.headers['accept-encoding']).toEqual('gzip');
  });

  it('can get compressed json from a response', async () => {
    const res = await requests.fetch(`http://localhost:${PORT}/gzip`, { method: 'GET' });
    expect(res.headers.get('content-type')).toEqual('text/plain');
    const json = await res.json();
    expect(json).toEqual({ text: 'value' });
    const serverResult = await promise;
    expect(serverResult.method).toEqual('GET');
    expect(serverResult.body).toEqual('');
  });
});

describe('given an instance of NodeRequests with enableEventCompression turned on', () => {
  const requests = new ElectronRequests(undefined, undefined, undefined, true);
  it('can make a basic post with compressBodyIfPossible enabled', async () => {
    await requests.fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      body: 'BODY TEXT',
      compressBodyIfPossible: true,
    });
    const serverResult = await promise;
    expect(serverResult.method).toEqual('POST');
    expect(serverResult.headers['content-encoding']).toEqual('gzip');
    expect(serverResult.body).toEqual(zlib.gzipSync('BODY TEXT'));
  });

  it('can make a basic post with compressBodyIfPossible disabled', async () => {
    await requests.fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      body: 'BODY TEXT',
      compressBodyIfPossible: false,
    });
    const serverResult = await promise;
    expect(serverResult.method).toEqual('POST');
    expect(serverResult.headers['content-encoding']).toBeUndefined();
    expect(serverResult.body).toEqual('BODY TEXT');
  });
});
