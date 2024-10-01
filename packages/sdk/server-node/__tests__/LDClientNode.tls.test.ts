import {
  AsyncQueue,
  sleepAsync,
  SSEItem,
  TestHttpHandlers,
  TestHttpServer,
} from 'launchdarkly-js-test-helpers';

import { LDClient, LDLogger } from '../src';
import LDClientNode from '../src/LDClientNode';

let logger: LDLogger;

beforeEach(() => {
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});

describe('When using a TLS connection', () => {
  let client: LDClient;
  let server: TestHttpServer;

  it('can connect via HTTPS to a server with a self-signed certificate, if CA is specified', async () => {
    server = await TestHttpServer.startSecure();
    server.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson({}));

    client = new LDClientNode('sdk-key', {
      baseUri: server.url,
      sendEvents: false,
      stream: false,
      logger,
      tlsParams: { ca: server.certificate },
      diagnosticOptOut: true,
    });
    await client.waitForInitialization({ timeout: 10 });
  });

  it('cannot connect via HTTPS to a server with a self-signed certificate, using default config', async () => {
    server = await TestHttpServer.startSecure();
    server.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson({}));

    client = new LDClientNode('sdk-key', {
      baseUri: server.url,
      sendEvents: false,
      stream: false,
      logger,
      diagnosticOptOut: true,
    });

    const spy = jest.spyOn(logger, 'warn');

    // the client won't signal an unrecoverable error, but it should log a message
    await sleepAsync(300);

    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/self.signed/));
  });

  it('can use custom TLS options for streaming as well as polling', async () => {
    const eventData = { data: { flags: { flag: { version: 1 } }, segments: {} } };
    const events = new AsyncQueue<SSEItem>();
    events.add({ type: 'put', data: JSON.stringify(eventData) });
    server = await TestHttpServer.startSecure();
    server.forMethodAndPath('get', '/stream/all', TestHttpHandlers.sseStream(events));

    client = new LDClientNode('sdk-key', {
      baseUri: server.url,
      streamUri: `${server.url}/stream`,
      sendEvents: false,
      logger,
      tlsParams: { ca: server.certificate },
      diagnosticOptOut: true,
    });

    // this won't return until the stream receives the "put" event
    await client.waitForInitialization({ timeout: 10 });
    events.close();
  });

  it('can use custom TLS options for posting events', async () => {
    server = await TestHttpServer.startSecure();
    server.forMethodAndPath('post', '/events/bulk', TestHttpHandlers.respond(200));
    server.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson({}));

    client = new LDClientNode('sdk-key', {
      baseUri: server.url,
      eventsUri: `${server.url}/events`,
      stream: false,
      tlsParams: { ca: server.certificate },
      diagnosticOptOut: true,
      logger,
    });

    await client.waitForInitialization({ timeout: 10 });
    client.identify({ key: 'user' });
    await client.flush();

    const flagsRequest = await server.nextRequest();
    expect(flagsRequest.path).toEqual('/sdk/latest-all');

    const eventsRequest = await server.nextRequest();
    expect(eventsRequest.path).toEqual('/events/bulk');
    const eventData = JSON.parse(eventsRequest.body!);
    expect(eventData.length).toEqual(1);
    expect(eventData[0].kind).toEqual('identify');
  });

  afterEach(() => {
    client.close();
    server.close();
  });
});
