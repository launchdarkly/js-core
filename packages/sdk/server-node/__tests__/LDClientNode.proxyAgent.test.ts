import * as http from 'http';

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

// This proves the proxyAgent option actually reaches the underlying request, through the full
// LDOptions -> NodePlatform -> NodeRequests wiring, rather than only the NodeRequests constructor.
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

  it('uses the supplied proxyAgent for polling requests', async () => {
    const server = await TestHttpServer.start();
    server.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson(allData));

    const agent = new http.Agent({ keepAlive: false });
    // addRequest exists at runtime but is not part of the public http.Agent type.
    // @ts-ignore
    const addRequestSpy = jest.spyOn(agent, 'addRequest');
    const warnSpy = jest.spyOn(logger, 'warn');

    const client = new LDClientNode(sdkKey, {
      baseUri: server.url,
      proxyAgent: agent,
      stream: false,
      sendEvents: false,
      logger,
    });

    closeable.push(server, client);

    await client.waitForInitialization({ timeout: 10 });
    expect(client.initialized()).toBe(true);
    expect(addRequestSpy).toHaveBeenCalled();
    // proxyAgent is a real, known LDOptions member; the shared Configuration validator should
    // not flag it as unrecognized just because it isn't part of the common LDOptions.
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('unknown config option'));
  });

  it('uses the supplied proxyAgent for streaming requests', async () => {
    const server = await TestHttpServer.start();
    const events = new AsyncQueue<SSEItem>();
    events.add({ type: 'put', data: JSON.stringify({ data: allData }) });
    server.forMethodAndPath('get', '/all', TestHttpHandlers.sseStream(events));

    const agent = new http.Agent({ keepAlive: false });
    // addRequest exists at runtime but is not part of the public http.Agent type.
    // @ts-ignore
    const addRequestSpy = jest.spyOn(agent, 'addRequest');

    const client = new LDClientNode(sdkKey, {
      streamUri: server.url,
      proxyAgent: agent,
      sendEvents: false,
      logger,
    });

    closeable.push(server, events, client);

    await client.waitForInitialization({ timeout: 10 });
    expect(client.initialized()).toBe(true);
    expect(addRequestSpy).toHaveBeenCalled();
  });
});
