import * as http from 'http';
import * as zlib from 'zlib';

// electron.net isn't available outside a real Electron main process, so this fakes just
// enough of the ClientRequest API to drive the local test server below over Node's real
// http module. Verified against real Electron 42.6.0: Chromium's net module transparently
// decompresses a compressed body while `IncomingMessage.headers` still reports the origin's
// original `content-encoding` -- this fake reproduces exactly that (see the scrutinize
// report for the real-Electron verification), rather than handing back a raw, never
// -transcoded Node response the way a naive passthrough would.
jest.mock('electron', () => {
  // eslint-disable-next-line global-require
  const { EventEmitter } = require('events');
  // eslint-disable-next-line global-require
  const nodeHttp = require('http');
  // eslint-disable-next-line global-require
  const nodeZlib = require('zlib');

  class ChromiumLikeResponse extends EventEmitter {
    headers: http.IncomingHttpHeaders;

    statusCode: number;

    constructor(headers: http.IncomingHttpHeaders, statusCode: number) {
      super();
      this.headers = headers;
      this.statusCode = statusCode;
    }
  }

  class FakeClientRequest extends EventEmitter {
    headers: Record<string, string> = {};

    chunks: Buffer[] = [];

    realRequest?: http.ClientRequest;

    ended: boolean = false;

    constructor(
      private options: {
        method?: string;
        url: string;
        redirect?: string;
        credentials?: string;
        cache?: string;
      },
    ) {
      super();
    }

    setHeader(name: string, value: string) {
      this.headers[name] = value;
    }

    write(chunk: string | Buffer) {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    end() {
      if (this.ended) {
        return;
      }
      this.ended = true;
      const body = Buffer.concat(this.chunks);
      this.realRequest = nodeHttp.request(
        this.options.url,
        { method: this.options.method, headers: this.headers },
        (res: http.IncomingMessage) => {
          // 'response' fires as soon as headers arrive, same as real net.request -- the
          // status/headers are available immediately, independent of whether the body ever
          // completes (this matters for the /reset scenario below).
          const fakeRes = new ChromiumLikeResponse(res.headers, res.statusCode!);
          this.emit('response', fakeRes);

          const raw: Buffer[] = [];
          res.on('data', (chunk: Buffer) => raw.push(chunk));
          res.on('aborted', () => fakeRes.emit('aborted'));
          res.on('error', (err: Error) => fakeRes.emit('error', err));
          res.on('end', () => {
            // Chromium decompresses transparently; the caller never sees compressed bytes,
            // even though res.headers still reports the origin's content-encoding.
            const decoded =
              res.headers['content-encoding'] === 'gzip'
                ? nodeZlib.gunzipSync(Buffer.concat(raw))
                : Buffer.concat(raw);
            if (decoded.length) {
              fakeRes.emit('data', decoded);
            }
            fakeRes.emit('end');
          });
        },
      );
      this.realRequest!.on('error', (err: Error) => this.emit('error', err));
      if (body.length) {
        this.realRequest!.write(body);
      }
      this.realRequest!.end();
    }

    abort() {
      this.realRequest?.destroy();
      this.emit('abort');
      this.emit('close');
    }
  }

  return {
    app: {
      isReady: jest.fn(() => true),
      whenReady: jest.fn(() => Promise.resolve()),
    },
    net: {
      request: jest.fn(
        (options: { method?: string; url: string }) => new FakeClientRequest(options),
      ),
    },
  };
});

// eslint-disable-next-line import/first
import { app as mockedElectronApp, net as mockedElectronNet } from 'electron';

// eslint-disable-next-line import/first
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
    } else if ((req.url?.indexOf('slow') || -1) >= 0) {
      setTimeout(() => {
        if (!res.destroyed) {
          res.end(TEXT_RESPONSE);
        }
      }, 200).unref();
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

describe('given a default instance of ElectronRequests', () => {
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

  it('rejects with a timeout error and aborts the underlying request', async () => {
    await expect(requests.fetch(`http://localhost:${PORT}/slow`, { timeout: 20 })).rejects.toThrow(
      'Request timed out',
    );
  });

  it('does not time out when the response arrives before the deadline', async () => {
    const res = await requests.fetch(`http://localhost:${PORT}`, { timeout: 5000 });
    expect(res.status).toEqual(200);
  });

  it('does not follow redirects, omits ambient session credentials, and bypasses the shared cache', async () => {
    await requests.fetch(`http://localhost:${PORT}`);
    expect(mockedElectronNet.request).toHaveBeenCalledWith(
      expect.objectContaining({
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
      }),
    );
  });
});

describe('given an instance of ElectronRequests with enableEventCompression turned on', () => {
  const requests = new ElectronRequests(true);
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

describe('given the app is not ready yet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    (mockedElectronApp.isReady as jest.Mock).mockReturnValue(true);
  });

  it('waits for whenReady() before issuing the request, then proceeds', async () => {
    (mockedElectronApp.isReady as jest.Mock).mockReturnValue(false);
    let readyResolve: () => void = () => {};
    (mockedElectronApp.whenReady as jest.Mock).mockReturnValue(
      new Promise<void>((res) => {
        readyResolve = res;
      }),
    );

    const requests = new ElectronRequests();
    const fetchPromise = requests.fetch(`http://localhost:${PORT}`);

    expect(mockedElectronNet.request).not.toHaveBeenCalled();

    readyResolve();
    const res = await fetchPromise;

    expect(res.status).toEqual(200);
    expect(mockedElectronNet.request).toHaveBeenCalled();
  });

  it('does not call whenReady() when the app is already ready', async () => {
    const requests = new ElectronRequests();
    await requests.fetch(`http://localhost:${PORT}`);

    expect(mockedElectronApp.whenReady).not.toHaveBeenCalled();
  });
});
