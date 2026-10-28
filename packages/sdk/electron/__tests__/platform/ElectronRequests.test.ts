import * as http from 'http';
import * as zlib from 'zlib';

// electron.net isn't available outside a real Electron main process. net.fetch is a standard
// fetch over Chromium's stack, so Node's own fetch stands in for it. Both decode a compressed
// body and keep the origin's content-encoding header.
jest.mock('electron', () => ({
  app: {
    isReady: jest.fn(() => true),
    whenReady: jest.fn(() => Promise.resolve()),
  },
  net: {
    fetch: jest.fn((url: string, init: RequestInit) => globalThis.fetch(url, init)),
  },
}));

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
    expect(mockedElectronNet.fetch).toHaveBeenLastCalledWith(
      `http://localhost:${PORT}`,
      expect.objectContaining({
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
      }),
    );
  });
});

describe('given a streaming server', () => {
  // A long-lived server on its own port. Restarting a server per test leaves undici's pooled
  // connections pointing at the old one, which resets the next streaming request.
  const STREAM_PORT = 3334;
  const SSE_CHUNK = 'event: put\ndata: {"hello":"world"}\n\n';
  const requests = new ElectronRequests();
  let streamServer: http.Server;
  let streamRequest: Promise<TestRequestData>;
  let streamResolve: (value: TestRequestData) => void;

  beforeAll(async () => {
    streamServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        if (req.url === '/redirect') {
          res.writeHead(307, { Location: '/stream' });
          res.end();
          return;
        }
        streamResolve({
          method: req.method,
          body: Buffer.concat(chunks).toString(),
          headers: req.headers,
        });
        // Holds the connection open after the first event, like an SSE stream.
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(SSE_CHUNK);
      });
    });
    await new Promise<void>((res) => {
      streamServer.listen(STREAM_PORT, res);
    });
  });

  beforeEach(() => {
    streamRequest = new Promise<TestRequestData>((res) => {
      streamResolve = res;
    });
  });

  afterAll(
    async () =>
      new Promise((resolveClose) => {
        streamServer.close(resolveClose);
        streamServer.closeAllConnections();
      }),
  );

  it('delivers body chunks before the stream ends', async () => {
    const res = await requests.fetch(`http://localhost:${STREAM_PORT}/stream`, {
      streaming: true,
    });
    expect(res.status).toEqual(200);
    expect(res.headers.get('content-type')).toEqual('text/event-stream');

    const reader = res.body!.getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);
    expect(Buffer.from(first.value!).toString()).toEqual(SSE_CHUNK);
    await reader.cancel?.();
  });

  it('uses net.fetch with the method, headers, body, and signal', async () => {
    const controller = new AbortController();
    const res = await requests.fetch(`http://localhost:${STREAM_PORT}/stream`, {
      method: 'REPORT',
      headers: { 'Sample-Header': 'Some header value' },
      body: '{"key":"user"}',
      signal: controller.signal,
      timeout: 1,
      streaming: true,
    });
    expect(mockedElectronNet.fetch).toHaveBeenLastCalledWith(
      `http://localhost:${STREAM_PORT}/stream`,
      {
        method: 'REPORT',
        headers: { 'Sample-Header': 'Some header value' },
        body: '{"key":"user"}',
        signal: controller.signal,
        redirect: 'follow',
        credentials: 'omit',
        cache: 'no-store',
      },
    );
    const serverResult = await streamRequest;
    expect(serverResult.method).toEqual('REPORT');
    expect(serverResult.body).toEqual('{"key":"user"}');
    expect(serverResult.headers['sample-header']).toEqual('Some header value');
    expect(serverResult.headers['accept-encoding']).not.toEqual('gzip');
    controller.abort();
    await expect(res.body!.getReader().read()).rejects.toThrow('This operation was aborted');
  });

  it('follows a redirect', async () => {
    const res = await requests.fetch(`http://localhost:${STREAM_PORT}/redirect`, {
      streaming: true,
    });
    expect(res.status).toEqual(200);
    const reader = res.body!.getReader();
    const first = await reader.read();
    expect(Buffer.from(first.value!).toString()).toEqual(SSE_CHUNK);
    await reader.cancel?.();
  });

  it('waits for whenReady() before issuing the request', async () => {
    (mockedElectronNet.fetch as jest.Mock).mockClear();
    (mockedElectronApp.isReady as jest.Mock).mockReturnValueOnce(false);
    let readyResolve: () => void = () => {};
    (mockedElectronApp.whenReady as jest.Mock).mockReturnValueOnce(
      new Promise<void>((res) => {
        readyResolve = res;
      }),
    );

    const fetchPromise = requests.fetch(`http://localhost:${STREAM_PORT}/stream`, {
      streaming: true,
    });
    await Promise.resolve();
    expect(mockedElectronNet.fetch).not.toHaveBeenCalled();

    readyResolve();
    const res = await fetchPromise;
    expect(res.status).toEqual(200);
    await res.body!.cancel?.();
  });

  it('delivers server-sent events through createEventSource', async () => {
    const es = requests.createEventSource(`http://localhost:${STREAM_PORT}/stream`, {
      headers: { authorization: 'sdk-key' },
      errorFilter: () => true,
      initialRetryDelayMillis: 1000,
      readTimeoutMillis: 0,
      retryResetIntervalMillis: 60000,
    });
    try {
      const data = await new Promise<string>((resolveEvent) => {
        es.addEventListener('put', (event) => resolveEvent(event?.data));
      });
      expect(JSON.parse(data)).toEqual({ hello: 'world' });
      expect(mockedElectronNet.fetch).toHaveBeenCalled();
      const serverResult = await streamRequest;
      expect(serverResult.headers.authorization).toEqual('sdk-key');
      expect(serverResult.headers.accept).toEqual('text/event-stream');
    } finally {
      es.close();
    }
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

    expect(mockedElectronNet.fetch).not.toHaveBeenCalled();

    readyResolve();
    const res = await fetchPromise;

    expect(res.status).toEqual(200);
    expect(mockedElectronNet.fetch).toHaveBeenCalled();
  });

  it('does not call whenReady() when the app is already ready', async () => {
    const requests = new ElectronRequests();
    await requests.fetch(`http://localhost:${PORT}`);

    expect(mockedElectronApp.whenReady).not.toHaveBeenCalled();
  });
});
