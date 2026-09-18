import {
  AsyncQueue,
  TestHttpHandlers,
  TestHttpServer,
  TestHttpServers,
} from 'launchdarkly-js-test-helpers';

import createElectronFetch from '../../src/platform/ElectronFetch';
import ElectronRequests from '../../src/platform/ElectronRequests';

describe('given a running HTTP server', () => {
  let server: TestHttpServer;

  beforeEach(async () => {
    server = await TestHttpServers.start();
  });

  afterEach(async () => {
    await server.closeAndWait();
  });

  it('forwards the request and exposes the status, headers, and body chunks', async () => {
    const chunks = new AsyncQueue<string>();
    chunks.add('first');
    server.byDefault(
      TestHttpHandlers.chunkedStream(200, { 'content-type': 'text/event-stream' }, chunks),
    );

    const electronFetch = createElectronFetch();
    const res = await electronFetch(`${server.url}/stream`, {
      method: 'REPORT',
      headers: { authorization: 'sdk-key' },
      body: '{"kind":"user"}',
    });

    expect(res.status).toEqual(200);
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });
    expect(headers['content-type']).toEqual('text/event-stream');

    const reader = res.body?.getReader();
    const first = await reader?.read();
    expect(first?.done).toBe(false);
    expect(Buffer.from(first?.value ?? []).toString()).toEqual('first');

    const received = await server.nextRequest();
    expect(received.method.toUpperCase()).toEqual('REPORT');
    expect(received.headers.authorization).toEqual('sdk-key');
    expect(received.body).toEqual('{"kind":"user"}');
  });

  it('does not follow redirects', async () => {
    server.byDefault(TestHttpHandlers.respond(301, { location: `${server.url}/other` }));

    const electronFetch = createElectronFetch();
    const res = await electronFetch(server.url, { method: 'GET', headers: {} });

    expect(res.status).toEqual(301);
    expect(server.requestCount()).toEqual(1);
  });

  it('streams SSE events through createEventSource', async () => {
    const chunks = new AsyncQueue<string>();
    chunks.add('data: hello\n\n');
    server.byDefault(
      TestHttpHandlers.chunkedStream(200, { 'content-type': 'text/event-stream' }, chunks),
    );

    const requests = new ElectronRequests();
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
    await server.closeAndWait();
  });

  it('rejects the connection when the certificate is not trusted', async () => {
    // The Electron SDK exposes no TLS options. Verification follows the platform default, so a
    // self-signed certificate the machine does not trust must fail the request.
    const electronFetch = createElectronFetch();
    await expect(electronFetch(server.url, { method: 'GET', headers: {} })).rejects.toThrow();
  });
});
