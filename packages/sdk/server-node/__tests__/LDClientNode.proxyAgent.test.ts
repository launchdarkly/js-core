import { AsyncQueue, SSEItem, TestHttpHandlers, TestHttpServer } from 'launchdarkly-js-test-helpers';
import { SocksProxyAgent } from 'socks-proxy-agent';

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

// The proxyAgent option lets an application route SDK traffic through any agent it constructs. A
// SOCKS proxy is the motivating example: the SDK does not build SOCKS agents itself, so the
// application supplies a SocksProxyAgent and the SDK uses it for all connections.
describe('When using a custom proxyAgent', () => {
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

  it('routes polling traffic through a user-supplied SOCKS proxy agent', async () => {
    const proxy: SocksProxyServer = await startSocksProxyServer();
    const server = await TestHttpServer.start();
    server.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson(allData));

    const client = new LDClientNode(sdkKey, {
      baseUri: server.url,
      proxyAgent: new SocksProxyAgent(`socks5://${proxy.hostname}:${proxy.port}`),
      stream: false,
      sendEvents: false,
      logger,
    });

    closeable.push(proxy, server, client);

    await client.waitForInitialization({ timeout: 10 });
    expect(client.initialized()).toBe(true);

    // If the SOCKS proxy did not see a connection then the SDK did not actually use the agent.
    expect(proxy.requestCount()).toBeGreaterThanOrEqual(1);
  });

  it('routes streaming traffic through a user-supplied SOCKS proxy agent', async () => {
    const proxy: SocksProxyServer = await startSocksProxyServer();
    const server = await TestHttpServer.start();
    const events = new AsyncQueue<SSEItem>();
    events.add({ type: 'put', data: JSON.stringify({ data: allData }) });
    server.forMethodAndPath('get', '/all', TestHttpHandlers.sseStream(events));

    const client = new LDClientNode(sdkKey, {
      streamUri: server.url,
      proxyAgent: new SocksProxyAgent(`socks5://${proxy.hostname}:${proxy.port}`),
      sendEvents: false,
      logger,
    });

    closeable.push(proxy, server, events, client);

    await client.waitForInitialization({ timeout: 10 });
    expect(client.initialized()).toBe(true);

    expect(proxy.requestCount()).toBeGreaterThanOrEqual(1);
  });

  it('routes traffic through a SOCKS proxy agent with username/password authentication', async () => {
    const proxy: SocksProxyServer = await startSocksProxyServer({
      username: 'user',
      password: 'password',
    });
    const server = await TestHttpServer.start();
    server.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson(allData));

    const client = new LDClientNode(sdkKey, {
      baseUri: server.url,
      proxyAgent: new SocksProxyAgent(`socks5://user:password@${proxy.hostname}:${proxy.port}`),
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
