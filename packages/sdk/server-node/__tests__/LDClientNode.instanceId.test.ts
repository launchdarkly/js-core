import { TestHttpHandlers, TestHttpServer } from 'launchdarkly-js-test-helpers';

import { basicLogger, LDLogger } from '../src';
import LDClientNode from '../src/LDClientNode';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const allData = { flags: {}, segments: {} };

describe('LDClientNode X-LaunchDarkly-Instance-Id header', () => {
  let logger: LDLogger;
  let closeable: { close: () => void }[];

  beforeEach(() => {
    closeable = [];
    logger = basicLogger({ destination: () => {} });
  });

  afterEach(() => {
    closeable.forEach((c) => c.close());
  });

  it('sends a v4 UUID X-LaunchDarkly-Instance-Id header on polling requests', async () => {
    const server = await TestHttpServer.start();
    server.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson(allData));

    const client = new LDClientNode('sdk-key', {
      baseUri: server.url,
      stream: false,
      sendEvents: false,
      logger,
    });

    closeable.push(server, client);

    await client.waitForInitialization({ timeout: 10 });
    expect(client.initialized()).toBe(true);

    const req = await server.nextRequest();
    const headerValue = req.headers['x-launchdarkly-instance-id'];
    expect(headerValue).toMatch(UUID_V4_RE);
  });

  it('uses a different UUID for different SDK instances', async () => {
    const serverA = await TestHttpServer.start();
    const serverB = await TestHttpServer.start();
    serverA.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson(allData));
    serverB.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson(allData));

    const clientA = new LDClientNode('sdk-key-a', {
      baseUri: serverA.url,
      stream: false,
      sendEvents: false,
      logger,
    });
    const clientB = new LDClientNode('sdk-key-b', {
      baseUri: serverB.url,
      stream: false,
      sendEvents: false,
      logger,
    });

    closeable.push(serverA, serverB, clientA, clientB);

    await clientA.waitForInitialization({ timeout: 10 });
    await clientB.waitForInitialization({ timeout: 10 });

    const reqA = await serverA.nextRequest();
    const reqB = await serverB.nextRequest();

    const headerA = reqA.headers['x-launchdarkly-instance-id'];
    const headerB = reqB.headers['x-launchdarkly-instance-id'];

    expect(headerA).toMatch(UUID_V4_RE);
    expect(headerB).toMatch(UUID_V4_RE);
    expect(headerA).not.toEqual(headerB);
  });
});
