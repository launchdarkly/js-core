import {
  AsyncQueue,
  sleepAsync,
  SSEItem,
  TestHttpHandlers,
  TestHttpServer,
} from 'launchdarkly-js-test-helpers';
import { basicLogger, LDClient, LDLogger } from '../src';

import LDClientNode from '../src/LDClientNode';

describe('', () => {
  let client: LDClient;
  let server: TestHttpServer;
  let logger: LDLogger;

  beforeEach(() => {
    logger = basicLogger({
      destination: () => {}
    });
  });

  afterEach(() => {
    client.close();
    server.close();
  });
});
