import { AsyncQueue, SSEItem, TestHttpHandlers, TestHttpServer } from 'launchdarkly-js-test-helpers';

import { basicLogger, LDLogger } from '../src';
import LDClientNode from '../src/LDClientNode';
import { SocksProxyServer, startSocksProxyServer } from './socksProxyServer';

const sdkKey = 'sdkKey';
const flagKey = 'flagKey';
const expectedFlagValue = 'yes';
const flag = {
  key: flagKey,
  version: 1,
  on: false,
  offVariation: 0,
  variations: [expectedFlagValue, 'no'],
};
const allData = { flags: { flagKey: flag }, segments: {} };

describe('When using a SOCKS proxy', () => {
  let logger: LDLogger;
  let closeable: { close: () => void }[];

  beforeEach(() => {
    closeable = [];
    logger = basicLogger({
      destination: () => {},
    });
  });

  afterEach(() => {
    closeable.forEach((item) => item.close());
  });

  it('can use a SOCKS proxy in polling mode', async () => {
    const proxy: SocksProxyServer = await startSocksProxyServer();
    const server = await TestHttpServer.start();
    server.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson(allData));

    const client = new LDClientNode(sdkKey, {
      baseUri: server.url,
      proxyOptions: {
        host: proxy.hostname,
        port: proxy.port,
        scheme: 'socks5',
      },
      stream: false,
      sendEvents: false,
      logger,
    });

    closeable.push(proxy, server, client);

    await client.waitForInitialization({ timeout: 10 });
    expect(client.initialized()).toBe(true);

    // If the SOCKS proxy did not see a connection then the SDK did not actually use it.
    expect(proxy.requestCount()).toBeGreaterThanOrEqual(1);
  });

  it('can use a SOCKS proxy in streaming mode', async () => {
    const proxy: SocksProxyServer = await startSocksProxyServer();
    const server = await TestHttpServer.start();
    const events = new AsyncQueue<SSEItem>();
    events.add({ type: 'put', data: JSON.stringify({ data: allData }) });
    server.forMethodAndPath('get', '/all', TestHttpHandlers.sseStream(events));

    const client = new LDClientNode(sdkKey, {
      streamUri: server.url,
      proxyOptions: {
        host: proxy.hostname,
        port: proxy.port,
        scheme: 'socks5',
      },
      sendEvents: false,
      logger,
    });

    closeable.push(proxy, server, events, client);

    await client.waitForInitialization({ timeout: 10 });
    expect(client.initialized()).toBe(true);

    expect(proxy.requestCount()).toBeGreaterThanOrEqual(1);
  });

  it('can use a SOCKS proxy reached via an IPv6 literal host', async () => {
    // An IPv6 literal proxy host must be bracketed when building the proxy URL; without that the
    // URL is invalid and the agent cannot connect.
    const proxy: SocksProxyServer = await startSocksProxyServer({ bindAddress: '::1' });
    const server = await TestHttpServer.start();
    server.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson(allData));

    const client = new LDClientNode(sdkKey, {
      baseUri: server.url,
      proxyOptions: {
        host: proxy.hostname,
        port: proxy.port,
        scheme: 'socks5',
      },
      stream: false,
      sendEvents: false,
      logger,
    });

    closeable.push(proxy, server, client);

    await client.waitForInitialization({ timeout: 10 });
    expect(client.initialized()).toBe(true);

    expect(proxy.requestCount()).toBeGreaterThanOrEqual(1);
  });

  it('can use a SOCKS proxy with username/password authentication', async () => {
    // The password contains a colon to verify that everything after the first colon in `auth` is
    // treated as the password.
    const proxy: SocksProxyServer = await startSocksProxyServer({
      username: 'user',
      password: 'p@ss:word',
    });
    const server = await TestHttpServer.start();
    server.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson(allData));

    const client = new LDClientNode(sdkKey, {
      baseUri: server.url,
      proxyOptions: {
        host: proxy.hostname,
        port: proxy.port,
        scheme: 'socks5',
        auth: 'user:p@ss:word',
      },
      stream: false,
      sendEvents: false,
      logger,
    });

    closeable.push(proxy, server, client);

    await client.waitForInitialization({ timeout: 10 });
    expect(client.initialized()).toBe(true);

    expect(proxy.requestCount()).toBeGreaterThanOrEqual(1);
    expect(proxy.authFailures()).toEqual([]);
  });
});
