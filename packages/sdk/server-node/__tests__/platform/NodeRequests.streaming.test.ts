import * as http from 'http';
import * as https from 'https';
import {
  AsyncQueue,
  TestHttpHandlers,
  TestHttpServer,
  TestHttpServers,
} from 'launchdarkly-js-test-helpers';

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
  });

  it('does not request compressed content for a streaming request', async () => {
    const chunks = new AsyncQueue<string>();
    server.byDefault(TestHttpHandlers.chunkedStream(200, {}, chunks));

    const requests = new NodeRequests();
    await requests.fetch(server.url, { method: 'GET', streaming: true });

    const received = await server.nextRequest();
    expect(received.headers['accept-encoding']).toBeUndefined();
  });

  it('does not follow redirects for a streaming request', async () => {
    server.byDefault(TestHttpHandlers.respond(301, { location: `${server.url}/other` }));

    const requests = new NodeRequests();
    const res = await requests.fetch(server.url, { method: 'GET', streaming: true });

    expect(res.status).toEqual(301);
    expect(server.requestCount()).toEqual(1);
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
      const errors = new AsyncQueue<unknown>();
      es.addEventListener('error', (event) => errors.add(event));
      expect(await errors.take()).toBeDefined();
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
