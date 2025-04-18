import {
  AsyncQueue,
  SSEItem,
  TestHttpHandlers,
  TestHttpServer,
} from 'launchdarkly-js-test-helpers';

import { basicLogger, LDLogger } from '../src';
import LDClientNode from '../src/LDClientNode';

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

describe('When using a proxy', () => {
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

  it('can use proxy in polling mode', async () => {
    const proxy = await TestHttpServer.startProxy();
    const server = await TestHttpServer.start();
    server.forMethodAndPath('get', '/sdk/poll', TestHttpHandlers.respondJson(allData));

    const client = new LDClientNode(sdkKey, {
      baseUri: server.url,
      proxyOptions: {
        host: proxy.hostname,
        port: proxy.port,
      },
      stream: false,
      sendEvents: false,
      logger,
    });

    closeable.push(proxy, server, client);

    await client.waitForInitialization({ timeout: 10 });
    expect(client.initialized()).toBe(true);

    // If the proxy server did not log a request then the SDK did not actually use the proxy
    expect(proxy.requestCount()).toEqual(1);
    const req = await proxy.nextRequest();
    expect(req.path).toEqual(server.url);
  });

  it('can use proxy in streaming mode', async () => {
    const proxy = await TestHttpServer.startProxy();
    const server = await TestHttpServer.start();
    const events = new AsyncQueue<SSEItem>();
    events.add({ type: 'put', data: JSON.stringify({ data: allData }) });
    server.forMethodAndPath('get', '/sdk/stream', TestHttpHandlers.sseStream(events));

    const client = new LDClientNode(sdkKey, {
      streamUri: server.url,
      proxyOptions: {
        host: proxy.hostname,
        port: proxy.port,
      },
      sendEvents: false,
      logger,
    });

    closeable.push(proxy, server, events, client);

    await client.waitForInitialization({ timeout: 10 });
    expect(client.initialized()).toBe(true);

    // If the proxy server did not log a request then the SDK did not actually use the proxy
    expect(proxy.requestCount()).toEqual(1);
    const req = await proxy.nextRequest();
    expect(req.path).toEqual(server.url);
  });

  it('can use proxy for events', async () => {
    const proxy = await TestHttpServer.startProxy();
    const pollingServer = await TestHttpServer.start();
    const eventsServer = await TestHttpServer.start();
    pollingServer.forMethodAndPath('get', '/sdk/poll', TestHttpHandlers.respondJson(allData));
    eventsServer.forMethodAndPath('post', '/diagnostic', TestHttpHandlers.respond(200));

    const client = new LDClientNode(sdkKey, {
      baseUri: pollingServer.url,
      eventsUri: eventsServer.url,
      proxyOptions: {
        host: proxy.hostname,
        port: proxy.port,
      },
      stream: false,
      logger,
    });

    closeable.push(proxy, pollingServer, eventsServer, client);

    await client.waitForInitialization({ timeout: 10 });
    expect(client.initialized()).toBe(true);

    // If the proxy server did not log a request then the SDK did not actually use the proxy
    expect(proxy.requestCount()).toEqual(2);
    const req0 = await proxy.nextRequest();
    const req1 = await proxy.nextRequest();
    if (req0.path === pollingServer.url) {
      expect(req1.path).toEqual(eventsServer.url);
    } else {
      expect(req0.path).toEqual(eventsServer.url);
      expect(req1.path).toEqual(pollingServer.url);
    }
  });
});
