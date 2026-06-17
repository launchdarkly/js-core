import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { createClient } from '../src';
import { resetNodeStorage } from '../src/platform/NodeStorage';
import { createMockLogger } from './testHelpers';

let tmpRoot: string;
let logger: ReturnType<typeof createMockLogger>;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-client-test-'));
  resetNodeStorage();
  logger = createMockLogger();
});

afterEach(async () => {
  resetNodeStorage();
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

it('createClient returns the documented LDClient surface', () => {
  const client = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });

  expect(typeof client.start).toBe('function');
  expect(typeof client.identify).toBe('function');
  expect(typeof client.close).toBe('function');
  expect(typeof client.variation).toBe('function');
  expect(typeof client.variationDetail).toBe('function');
  expect(typeof client.boolVariation).toBe('function');
  expect(typeof client.boolVariationDetail).toBe('function');
  expect(typeof client.stringVariation).toBe('function');
  expect(typeof client.stringVariationDetail).toBe('function');
  expect(typeof client.numberVariation).toBe('function');
  expect(typeof client.numberVariationDetail).toBe('function');
  expect(typeof client.jsonVariation).toBe('function');
  expect(typeof client.jsonVariationDetail).toBe('function');
  expect(typeof client.allFlags).toBe('function');
  expect(typeof client.track).toBe('function');
  expect(typeof client.flush).toBe('function');
  expect(typeof client.on).toBe('function');
  expect(typeof client.off).toBe('function');
  expect(typeof client.addHook).toBe('function');
  expect(typeof client.waitForInitialization).toBe('function');
  expect(typeof client.setConnectionMode).toBe('function');
  expect(typeof client.getConnectionMode).toBe('function');
  expect(typeof client.isOffline).toBe('function');
  expect(typeof client.getContext).toBe('function');
  expect(client.logger).toBeDefined();
});

it('isOffline reflects initialConnectionMode', () => {
  const offline = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });
  expect(offline.isOffline()).toBe(true);
  expect(offline.getConnectionMode()).toBe('offline');
});

it('setConnectionMode round-trips to offline', async () => {
  const client = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });

  expect(client.getConnectionMode()).toBe('offline');
  expect(client.isOffline()).toBe(true);

  await client.setConnectionMode('offline');
  expect(client.getConnectionMode()).toBe('offline');
});

it('start completes in offline mode without performing network identify', async () => {
  const client = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });

  const result = await client.start({ timeout: 5 });
  expect(result.status).toBe('complete');
});
