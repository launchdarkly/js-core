import * as http from 'http';
import {
  AsyncQueue,
  TestHttpHandlers,
  TestHttpServer,
  TestHttpServers,
} from 'launchdarkly-js-test-helpers';
import * as net from 'net';

import NodeRequests from '../../src/platform/NodeRequests';

interface ConnectProxy {
  port: number;
  connectCount: () => number;
  close: () => Promise<void>;
}

// The launchdarkly-js-test-helpers proxy cannot tunnel to an HTTPS target, so these tests
// run their own minimal CONNECT proxy.
async function startConnectProxy(): Promise<ConnectProxy> {
  const sockets: { destroy: () => void }[] = [];
  let connects = 0;
  const server = http.createServer();
  server.on('connect', (req, clientSocket, head) => {
    connects += 1;
    const [host, port] = (req.url ?? '').split(':');
    const serverSocket = net.connect(Number(port), host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });
    sockets.push(clientSocket, serverSocket);
    serverSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => serverSocket.destroy());
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as net.AddressInfo;
  return {
    port,
    connectCount: () => connects,
    close: () =>
      new Promise((resolve) => {
        sockets.forEach((socket) => socket.destroy());
        server.close(() => resolve());
      }),
  };
}

describe('given a CONNECT proxy and an HTTPS server with a self-signed certificate', () => {
  let server: TestHttpServer;
  let proxy: ConnectProxy;

  beforeEach(async () => {
    server = await TestHttpServers.startSecure();
    proxy = await startConnectProxy();
  });

  afterEach(async () => {
    await proxy.close();
    await server.closeAndWait();
  });

  it('streams through the proxy when the CA is supplied in the TLS options', async () => {
    const chunks = new AsyncQueue<string>();
    chunks.add('data: tunneled\n\n');
    server.byDefault(
      TestHttpHandlers.chunkedStream(200, { 'content-type': 'text/event-stream' }, chunks),
    );

    const requests = new NodeRequests(
      { ca: server.certificate },
      { host: '127.0.0.1', port: proxy.port },
    );
    const res = await requests.fetch(server.url, { method: 'GET', streaming: true });

    expect(res.status).toEqual(200);
    const first = await res.body?.getReader().read();
    expect(Buffer.from(first?.value ?? []).toString()).toContain('tunneled');
    expect(proxy.connectCount()).toEqual(1);
  });

  it('routes a streaming redirect hop through the proxy', async () => {
    // The hop must keep the proxy agent. A hop that drops the agent would connect to the
    // target directly, and the tunnel count would stay at one.
    server.forMethodAndPath(
      'get',
      '/entry',
      TestHttpHandlers.respond(301, { location: `${server.url}/stream` }),
    );
    server.byDefault(TestHttpHandlers.respond(200));

    const requests = new NodeRequests(
      { ca: server.certificate },
      { host: '127.0.0.1', port: proxy.port },
    );
    const res = await requests.fetch(`${server.url}/entry`, { method: 'GET', streaming: true });

    expect(res.status).toEqual(200);
    // Each hop opens its own tunnel, because a followed redirect response is destroyed.
    expect(proxy.connectCount()).toEqual(2);
  });

  it('completes a buffered request through the proxy when the CA is supplied in the TLS options', async () => {
    server.byDefault(TestHttpHandlers.respond(200, {}, 'ok'));

    const requests = new NodeRequests(
      { ca: server.certificate },
      { host: '127.0.0.1', port: proxy.port },
    );
    const res = await requests.fetch(server.url, { method: 'GET' });

    expect(res.status).toEqual(200);
    expect(await res.text()).toEqual('ok');
    expect(proxy.connectCount()).toEqual(1);
  });

  it('rejects a buffered request through the proxy when no CA is supplied', async () => {
    server.byDefault(TestHttpHandlers.respond(200, {}, 'ok'));

    const requests = new NodeRequests(undefined, { host: '127.0.0.1', port: proxy.port });
    await expect(requests.fetch(server.url, { method: 'GET' })).rejects.toThrow();
  });
});
