import { getEventListeners } from 'events';
// Default imports keep the live module objects so jest.spyOn can patch them.
// Namespace imports compile to frozen copies under this package's node16 module setting.
import http from 'http';
import https from 'https';
import {
  AsyncQueue,
  TestHttpHandlers,
  TestHttpServer,
  TestHttpServers,
} from 'launchdarkly-js-test-helpers';
import * as net from 'net';

import { internal, platform } from '@launchdarkly/js-server-sdk-common';

import NodeRequests from '../../src/platform/NodeRequests';

describe('given a running HTTP server', () => {
  let server: TestHttpServer;

  beforeEach(async () => {
    server = await TestHttpServers.start();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await server.closeAndWait();
  });

  it('forwards a streaming request and exposes the status, headers, and body chunks', async () => {
    const chunks = new AsyncQueue<string>();
    chunks.add('first');
    server.byDefault(
      TestHttpHandlers.chunkedStream(200, { 'content-type': 'text/event-stream' }, chunks),
    );

    const requests = new NodeRequests();
    const res = await requests.fetch(`${server.url}/stream`, {
      method: 'REPORT',
      headers: { authorization: 'sdk-key' },
      body: '{"kind":"user"}',
      streaming: true,
    });

    expect(res.status).toEqual(200);
    const collected: Record<string, string> = {};
    res.headers.forEach?.((value, key) => {
      collected[key] = value;
    });
    expect(collected['content-type']).toEqual('text/event-stream');

    const reader = res.body?.getReader();
    const first = await reader?.read();
    expect(first?.done).toBe(false);
    expect(Buffer.from(first?.value ?? []).toString()).toEqual('first');

    const received = await server.nextRequest();
    expect(received.method.toUpperCase()).toEqual('REPORT');
    expect(received.headers.authorization).toEqual('sdk-key');
    expect(received.body).toEqual('{"kind":"user"}');
    // Closing the queue ends the chunked response, so no read stays pending at teardown.
    chunks.close();
  });

  it('does not request compressed content for a streaming request', async () => {
    server.byDefault(TestHttpHandlers.respond(200));

    const requests = new NodeRequests();
    await requests.fetch(server.url, { method: 'GET', streaming: true });

    const received = await server.nextRequest();
    expect(received.headers['accept-encoding']).toBeUndefined();
  });

  it.each([301, 307])(
    'follows a %s redirect for a streaming request and re-sends the method, body, and headers',
    async (status) => {
      const chunks = new AsyncQueue<string>();
      server.forMethodAndPath(
        'report',
        '/',
        TestHttpHandlers.respond(status, { location: `${server.url}/other` }),
      );
      server.forMethodAndPath(
        'report',
        '/other',
        TestHttpHandlers.chunkedStream(200, { 'content-type': 'text/event-stream' }, chunks),
      );

      const requests = new NodeRequests();
      const res = await requests.fetch(server.url, {
        method: 'REPORT',
        headers: { authorization: 'sdk-key' },
        body: '{"kind":"user"}',
        streaming: true,
      });

      expect(res.status).toEqual(200);
      await server.nextRequest();
      const redirected = await server.nextRequest();
      expect(redirected.path).toEqual('/other');
      expect(redirected.method.toUpperCase()).toEqual('REPORT');
      expect(redirected.headers.authorization).toEqual('sdk-key');
      expect(redirected.body).toEqual('{"kind":"user"}');
    },
  );

  it('does not follow a 302 for a streaming request', async () => {
    server.byDefault(TestHttpHandlers.respond(302, { location: `${server.url}/other` }));

    const requests = new NodeRequests();
    const res = await requests.fetch(server.url, { method: 'GET', streaming: true });

    expect(res.status).toEqual(302);
    expect(server.requestCount()).toEqual(1);
  });

  it('stops following a streaming redirect chain at the hop limit', async () => {
    server.byDefault(TestHttpHandlers.respond(301, { location: `${server.url}/` }));

    const requests = new NodeRequests();
    const res = await requests.fetch(server.url, { method: 'GET', streaming: true });

    expect(res.status).toEqual(301);
    // The initial request plus one request per allowed hop. The next redirect goes to the
    // caller.
    expect(server.requestCount()).toEqual(internal.MAX_STREAMING_REDIRECT_HOPS + 1);
  });

  it('uses TLS for a redirect hop to an https target', async () => {
    // A raw TCP listener stands in for the https target. The first byte it receives shows
    // which transport the hop used. A TLS handshake starts with the record type 0x16. A
    // plaintext HTTP request starts with an ASCII method character.
    const raw = net.createServer();
    await new Promise<void>((resolve) => {
      raw.listen(0, '127.0.0.1', resolve);
    });
    try {
      const { port } = raw.address() as net.AddressInfo;
      const firstByte = new Promise<number>((resolve) => {
        raw.on('connection', (socket) => {
          socket.once('data', (data) => {
            resolve(data[0]);
            socket.destroy();
          });
        });
      });
      server.byDefault(TestHttpHandlers.respond(301, { location: `https://127.0.0.1:${port}/` }));

      const requests = new NodeRequests();
      // The listener destroys the connection mid-handshake, so the fetch rejects.
      await expect(
        requests.fetch(server.url, { method: 'GET', streaming: true }),
      ).rejects.toThrow();

      // A hop that never connects must fail this test, not hang it on the unsettled promise.
      const received = await Promise.race([
        firstByte,
        new Promise<number>((resolve) => {
          setTimeout(() => resolve(-1), 1000).unref();
        }),
      ]);
      expect(received).toEqual(0x16);
    } finally {
      await new Promise<void>((resolve) => {
        raw.close(() => resolve());
      });
    }
  });

  it('stops the stream when the signal aborts', async () => {
    const chunks = new AsyncQueue<string>();
    chunks.add('first');
    server.byDefault(TestHttpHandlers.chunkedStream(200, {}, chunks));

    const controller = new AbortController();
    const requests = new NodeRequests();
    const res = await requests.fetch(server.url, {
      method: 'GET',
      streaming: true,
      signal: controller.signal,
    });
    const reader = res.body?.getReader();
    await reader?.read();
    const pending = reader?.read();
    controller.abort();
    await expect(pending).rejects.toThrow();
  });

  it('rejects a streaming request when the signal is already aborted', async () => {
    server.byDefault(TestHttpHandlers.respond(200));
    const controller = new AbortController();
    controller.abort();

    const requests = new NodeRequests();
    await expect(
      requests.fetch(server.url, { method: 'GET', streaming: true, signal: controller.signal }),
    ).rejects.toThrow();
    expect(server.requestCount()).toEqual(0);
  });

  it('rejects when the signal aborts before the response arrives', async () => {
    // The handler never responds, so the abort happens while the request waits for headers.
    server.byDefault(() => {});

    const controller = new AbortController();
    const requests = new NodeRequests();
    const pending = requests.fetch(server.url, {
      method: 'GET',
      streaming: true,
      signal: controller.signal,
    });
    await server.nextRequest();
    controller.abort();
    await expect(pending).rejects.toThrow();
  });

  it.each(['reader', 'body'] as const)(
    'closes the connection when the %s is cancelled',
    async (target) => {
      const closed = new AsyncQueue<void>();
      server.byDefault((_req, res) => {
        // The response never ends, so the close event shows that the client released the
        // connection.
        res.on('close', () => closed.add());
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('first');
      });

      const requests = new NodeRequests();
      const res = await requests.fetch(server.url, { method: 'GET', streaming: true });
      const reader = res.body?.getReader();
      await reader?.read();
      await (target === 'reader' ? reader : res.body)?.cancel?.();

      await expect(closed.take()).resolves.toBeUndefined();
    },
  );

  it('ignores the timeout option for a streaming request', async () => {
    const chunks = new AsyncQueue<string>();
    chunks.add('first');
    server.byDefault(TestHttpHandlers.chunkedStream(200, {}, chunks));
    // The spy captures the outgoing request. A timeout option would set its timeout field and
    // attach a timeout listener.
    const endSpy = jest.spyOn(http.ClientRequest.prototype, 'end');

    const requests = new NodeRequests();
    const res = await requests.fetch(server.url, { method: 'GET', streaming: true, timeout: 10 });

    expect(endSpy).toHaveBeenCalledTimes(1);
    // Node sets the timeout field at run time, but some @types/node versions do not declare it.
    const req = endSpy.mock.contexts[0] as http.ClientRequest & { timeout?: number };
    expect(req.timeout).toBeUndefined();
    expect(req.listenerCount('timeout')).toEqual(0);
    await res.body?.cancel?.();
  });

  it('removes the abort listener when the stream ends', async () => {
    server.byDefault(TestHttpHandlers.respond(200, {}, 'done'));

    const controller = new AbortController();
    const requests = new NodeRequests();
    const res = await requests.fetch(server.url, {
      method: 'GET',
      streaming: true,
      signal: controller.signal,
    });
    const reader = res.body?.getReader();
    const first = await reader?.read();
    const second = first?.done ? first : await reader?.read();
    expect(second?.done).toBe(true);
    // Node removes the listener on the request close event, which lands after the final read.
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  });

  it('uses the supplied agent for a streaming request', async () => {
    server.byDefault(TestHttpHandlers.respond(200));
    const agent = new http.Agent({ keepAlive: false });
    // addRequest exists at runtime but is not part of the public http.Agent type.
    // @ts-ignore
    const addRequestSpy = jest.spyOn(agent, 'addRequest');

    const requests = new NodeRequests(undefined, undefined, agent);
    await requests.fetch(server.url, { method: 'GET', streaming: true });

    expect(addRequestSpy).toHaveBeenCalled();
  });

  it('does not pass the CA to the per-request options of an http streaming request', async () => {
    const requestSpy = jest.spyOn(http, 'request');

    const requests = new NodeRequests({ ca: 'unused-ca' });
    // The https agent built from the TLS options is rejected for an http URL, so the request
    // fails after http.request has already received its options.
    await requests.fetch(server.url, { method: 'GET', streaming: true }).catch(() => undefined);

    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy.mock.calls[0][1]).not.toHaveProperty('ca');
  });

  it('streams SSE events through createEventSource', async () => {
    const chunks = new AsyncQueue<string>();
    chunks.add('data: hello\n\n');
    server.byDefault(
      TestHttpHandlers.chunkedStream(200, { 'content-type': 'text/event-stream' }, chunks),
    );

    const requests = new NodeRequests();
    const es = requests.createEventSource(`${server.url}/stream`, {
      headers: {},
      initialRetryDelayMillis: 100,
      readTimeoutMillis: 5000,
      retryResetIntervalMillis: 30_000,
      errorFilter: () => false,
    });
    try {
      const messages = new AsyncQueue<{ data?: string }>();
      es.addEventListener('message', (event) => messages.add(event ?? {}));
      const message = await messages.take();
      expect(message.data).toEqual('hello');
    } finally {
      es.close();
    }
  });
});

describe('given a running HTTPS server with a self-signed certificate', () => {
  let server: TestHttpServer;

  beforeEach(async () => {
    server = await TestHttpServers.startSecure();
    server.byDefault(TestHttpHandlers.respond(200));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await server.closeAndWait();
  });

  it('connects a streaming request when the CA is supplied in the TLS options', async () => {
    const requests = new NodeRequests({ ca: server.certificate });
    const res = await requests.fetch(server.url, { method: 'GET', streaming: true });
    expect(res.status).toEqual(200);
  });

  it('applies the TLS options to a redirect hop', async () => {
    // The hop must carry the agent and the per-request TLS options. Without the CA on the
    // hop, the self-signed certificate fails verification and the fetch rejects.
    server.forMethodAndPath(
      'get',
      '/entry',
      TestHttpHandlers.respond(301, { location: `${server.url}/stream` }),
    );

    const requests = new NodeRequests({ ca: server.certificate });
    const res = await requests.fetch(`${server.url}/entry`, { method: 'GET', streaming: true });

    expect(res.status).toEqual(200);
    expect((await server.nextRequest()).path).toEqual('/entry');
    expect((await server.nextRequest()).path).toEqual('/stream');
  });

  it('passes the CA to the per-request options of an https streaming request', async () => {
    const requestSpy = jest.spyOn(https, 'request');

    const requests = new NodeRequests({ ca: server.certificate });
    await requests.fetch(server.url, { method: 'GET', streaming: true });

    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({ ca: server.certificate }),
    );
  });

  it('rejects a streaming request when no CA is supplied', async () => {
    const requests = new NodeRequests();
    await expect(requests.fetch(server.url, { method: 'GET', streaming: true })).rejects.toThrow();
  });

  it('fails the stream against an untrusted certificate by default', async () => {
    const requests = new NodeRequests();
    const es = requests.createEventSource(`${server.url}/stream`, {
      headers: {},
      initialRetryDelayMillis: 100,
      readTimeoutMillis: 5000,
      retryResetIntervalMillis: 30_000,
      errorFilter: () => false,
    });
    try {
      const errors = new AsyncQueue<platform.HttpErrorResponse | undefined>();
      es.onerror = (err) => errors.add(err);
      // The certificate failure ends the connection before any HTTP response, so the error
      // carries the TLS message and no status. That separates it from the fetch-level test.
      const err = await errors.take();
      expect(err?.message).toMatch(/self[- ]signed certificate/);
      expect(err?.status).toBeUndefined();
    } finally {
      es.close();
    }
  });

  it('streams over TLS when the CA is supplied in the TLS options', async () => {
    const chunks = new AsyncQueue<string>();
    chunks.add('data: secure\n\n');
    server.byDefault(
      TestHttpHandlers.chunkedStream(200, { 'content-type': 'text/event-stream' }, chunks),
    );

    const requests = new NodeRequests({ ca: server.certificate });
    const es = requests.createEventSource(`${server.url}/stream`, {
      headers: {},
      initialRetryDelayMillis: 100,
      readTimeoutMillis: 5000,
      retryResetIntervalMillis: 30_000,
      errorFilter: () => false,
    });
    try {
      const messages = new AsyncQueue<{ data?: string }>();
      es.addEventListener('message', (event) => messages.add(event ?? {}));
      const message = await messages.take();
      expect(message.data).toEqual('secure');
    } finally {
      es.close();
    }
  });

  it('does not pass the CA to the per-request options when a proxyAgent is supplied', async () => {
    const requestSpy = jest.spyOn(https, 'request');
    const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };

    const requests = new NodeRequests(
      { ca: server.certificate },
      undefined,
      new https.Agent({ ca: server.certificate }),
      logger,
    );
    await requests.fetch(server.url, { method: 'GET', streaming: true });

    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy.mock.calls[0][1]).not.toHaveProperty('ca');
  });
});
