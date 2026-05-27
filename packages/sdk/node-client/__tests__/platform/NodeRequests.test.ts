import { TestHttpHandlers, TestHttpServers, withCloseable } from 'launchdarkly-js-test-helpers';

import { createMockLogger } from '../testHelpers';
import NodeRequests from '../../src/platform/NodeRequests';

it('reports event source capabilities (read timeout, custom headers, custom method)', () => {
  const requests = new NodeRequests();
  expect(requests.getEventSourceCapabilities()).toEqual({
    readTimeout: true,
    headers: true,
    customMethod: true,
  });
});

it('reports proxy status flags based on constructor input', () => {
  expect(new NodeRequests().usingProxy()).toBe(false);
  expect(new NodeRequests().usingProxyAuth()).toBe(false);

  const withProxy = new NodeRequests(undefined, { host: 'localhost', port: 8080 });
  expect(withProxy.usingProxy()).toBe(true);
  expect(withProxy.usingProxyAuth()).toBe(false);

  const withAuth = new NodeRequests(undefined, {
    host: 'localhost',
    port: 8080,
    auth: 'user:pass',
  });
  expect(withAuth.usingProxy()).toBe(true);
  expect(withAuth.usingProxyAuth()).toBe(true);
});

it('warns when proxy is configured with TLS but using an http scheme', () => {
  const logger = createMockLogger();

  // eslint-disable-next-line no-new
  new NodeRequests(
    { ca: 'fake-ca' },
    { host: 'localhost', port: 8080, scheme: 'http' },
    logger,
  );

  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('Proxy configured with TLS options'),
  );
});

describe('against an HTTP server', () => {
  it('forwards method, path, and headers for a GET request', async () => {
    await withCloseable(TestHttpServers.start, async (server: any) => {
      server.forMethodAndPath('get', '/path', TestHttpHandlers.respond(200));

      const requests = new NodeRequests();
      await requests.fetch(`${server.url}/path`, {
        method: 'GET',
        headers: { a: '1', b: '2' },
      });

      expect(server.requestCount()).toEqual(1);
      const req = await server.nextRequest();
      expect(req.method.toUpperCase()).toEqual('GET');
      expect(req.path).toEqual('/path');
      expect(req.headers.a).toEqual('1');
      expect(req.headers.b).toEqual('2');
    });
  });

  it('forwards a POST request body to the server', async () => {
    await withCloseable(TestHttpServers.start, async (server: any) => {
      server.forMethodAndPath('post', '/path', TestHttpHandlers.respond(200));

      const requests = new NodeRequests();
      await requests.fetch(`${server.url}/path`, {
        method: 'POST',
        headers: { a: '1' },
        body: '{}',
      });

      const req = await server.nextRequest();
      expect(req.method.toUpperCase()).toEqual('POST');
      expect(req.headers.a).toEqual('1');
      expect(req.body).toEqual('{}');
    });
  });

  it('returns response status, headers, and body', async () => {
    await withCloseable(TestHttpServers.start, async (server: any) => {
      server.byDefault(TestHttpHandlers.respond(200, { 'content-type': 'text/plain' }, 'hello'));

      const requests = new NodeRequests();
      const response = await requests.fetch(server.url);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/plain');
      await expect(response.text()).resolves.toBe('hello');
    });
  });

  it('rejects the fetch promise on a network error', async () => {
    await withCloseable(TestHttpServers.start, async (server: any) => {
      server.byDefault(TestHttpHandlers.networkError());

      const requests = new NodeRequests();
      await expect(requests.fetch(server.url)).rejects.toThrow();
    });
  });

  it('requests gzip on GET requests by default', async () => {
    await withCloseable(TestHttpServers.start, async (server: any) => {
      server.byDefault(TestHttpHandlers.respond(200));

      const requests = new NodeRequests();
      await requests.fetch(server.url, { method: 'GET' });

      const req = await server.nextRequest();
      expect(req.headers['accept-encoding']).toEqual('gzip');
    });
  });

  it('sets content-encoding gzip on POST bodies when compression is enabled and requested', async () => {
    await withCloseable(TestHttpServers.start, async (server: any) => {
      server.byDefault(TestHttpHandlers.respond(200));

      const requests = new NodeRequests(undefined, undefined, undefined, true);
      const body = JSON.stringify({ payload: 'x'.repeat(64) });
      await requests.fetch(server.url, {
        method: 'POST',
        body,
        compressBodyIfPossible: true,
      });

      const req = await server.nextRequest();
      expect(req.headers['content-encoding']).toEqual('gzip');
      expect(req.body).not.toEqual(body);
    });
  });

  it('does not compress POST bodies when compressBodyIfPossible is not requested', async () => {
    await withCloseable(TestHttpServers.start, async (server: any) => {
      server.byDefault(TestHttpHandlers.respond(200));

      const requests = new NodeRequests(undefined, undefined, undefined, true);
      await requests.fetch(server.url, { method: 'POST', body: 'plain' });

      const req = await server.nextRequest();
      expect(req.headers['content-encoding']).toBeUndefined();
      expect(req.body).toEqual('plain');
    });
  });

  it('does not compress POST bodies when enableEventCompression is false', async () => {
    await withCloseable(TestHttpServers.start, async (server: any) => {
      server.byDefault(TestHttpHandlers.respond(200));

      const requests = new NodeRequests();
      await requests.fetch(server.url, {
        method: 'POST',
        body: 'plain',
        compressBodyIfPossible: true,
      });

      const req = await server.nextRequest();
      expect(req.headers['content-encoding']).toBeUndefined();
      expect(req.body).toEqual('plain');
    });
  });

  it('creates an event source against the given url', async () => {
    await withCloseable(TestHttpServers.start, async (server: any) => {
      const requests = new NodeRequests();
      const es = requests.createEventSource(`${server.url}/stream`, {
        headers: {},
        initialRetryDelayMillis: 100,
        readTimeoutMillis: 1000,
        retryResetIntervalMillis: 30_000,
        errorFilter: () => true,
      });
      expect(es).toBeDefined();
      (es as { close: () => void }).close();
    });
  });
});

describe('against an HTTPS server with a self-signed certificate', () => {
  it('connects when the CA is provided in tlsParams', async () => {
    await withCloseable(TestHttpServers.startSecure, async (server: any) => {
      server.byDefault(TestHttpHandlers.respond(200));

      const requests = new NodeRequests({ ca: server.certificate });
      const response = await requests.fetch(server.url);
      expect(response.status).toBe(200);
    });
  });

  it('rejects the connection when no CA is provided', async () => {
    await withCloseable(TestHttpServers.startSecure, async (server: any) => {
      server.byDefault(TestHttpHandlers.respond(200));

      const requests = new NodeRequests();
      await expect(requests.fetch(server.url)).rejects.toMatchObject({
        code: expect.stringMatching(/SELF[_-]SIGNED|DEPTH_ZERO_SELF_SIGNED_CERT/i),
      });
    });
  });
});
