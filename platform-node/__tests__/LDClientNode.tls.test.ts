import { LDClient } from '../src';

import {
  AsyncQueue,
  sleepAsync,
  TestHttpHandlers,
  TestHttpServer,
  withCloseable
} from 'launchdarkly-js-test-helpers';
import LDClientNode from '../src/LDClientNode';

describe('', () => {
  let client: LDClient;
  let server: TestHttpServer;

  it(
    'can connect via HTTPS to a server with a self-signed certificate, if CA is specified',
    async () => {
      server = await TestHttpServer.startSecure();
      server.forMethodAndPath('get', '/sdk/latest-all', TestHttpHandlers.respondJson({}));

      client = new LDClientNode('sdk-key', {
        baseUri: server.url,
        sendEvents: false,
        stream: false,
        tlsParams: { ca: server.certificate },
        diagnosticOptOut: true,
      });
      await client.waitForInitialization();
    });

  afterEach(() => {
    client.close();
    server.close();
  });
});