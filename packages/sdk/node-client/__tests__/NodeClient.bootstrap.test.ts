import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { createClient } from '../src';
import { resetNodeStorage } from '../src/platform/NodeStorage';
import { createMockLogger } from './testHelpers';

let tmpRoot: string;
let logger: ReturnType<typeof createMockLogger>;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-client-bootstrap-test-'));
  resetNodeStorage();
  logger = createMockLogger();
});

afterEach(async () => {
  resetNodeStorage();
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

const goodBootstrapData = {
  'string-flag': 'is bob',
  'my-boolean-flag': false,
  $flagsState: {
    'string-flag': {
      variation: 1,
      version: 3,
    },
    'my-boolean-flag': {
      variation: 1,
      version: 11,
    },
  },
  $valid: true,
};

const bootstrapDataWithReasons = {
  json: ['a', 'b', 'c', 'd'],
  $flagsState: {
    json: {
      variation: 1,
      version: 3,
      reason: { kind: 'OFF' },
    },
  },
  $valid: true,
};

it('start with bootstrap data resolves and exposes flags', async () => {
  const client = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });

  const result = await client.start({ bootstrap: goodBootstrapData });

  expect(result.status).toBe('complete');
  expect(client.stringVariation('string-flag', 'default')).toBe('is bob');
  expect(client.boolVariation('my-boolean-flag', true)).toBe(false);
});

it('exposes evaluation reasons from bootstrap data', async () => {
  const client = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });

  await client.start({ bootstrap: bootstrapDataWithReasons });

  expect(client.jsonVariationDetail('json', undefined)).toEqual({
    reason: { kind: 'OFF' },
    value: ['a', 'b', 'c', 'd'],
    variationIndex: 1,
  });
});

it('re-identifying with new bootstrap data replaces previous flags', async () => {
  const newBootstrapData = {
    'string-flag': 'is alice',
    'my-boolean-flag': true,
    $flagsState: {
      'string-flag': { variation: 1, version: 4 },
      'my-boolean-flag': { variation: 0, version: 12 },
    },
    $valid: true,
  };

  const client = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });

  await client.start({ bootstrap: goodBootstrapData });
  expect(client.stringVariation('string-flag', 'default')).toBe('is bob');

  await client.identify({ kind: 'user', key: 'alice' }, { bootstrap: newBootstrapData });
  expect(client.stringVariation('string-flag', 'default')).toBe('is alice');
  expect(client.boolVariation('my-boolean-flag', false)).toBe(true);
});

it('warns that waitForNetworkResults is ignored when combined with bootstrap', async () => {
  const client = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });

  await client.start({ bootstrap: goodBootstrapData });
  const result = await client.identify(
    { kind: 'user', key: 'alice' },
    { bootstrap: goodBootstrapData, waitForNetworkResults: true },
  );

  expect(result.status).toBe('completed');
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('waitForNetworkResults'));
});

it('returns defaults when no bootstrap data is provided', async () => {
  const client = createClient('client-side-id', { kind: 'user', key: 'bob' }, {
    initialConnectionMode: 'offline',
    sendEvents: false,
    diagnosticOptOut: true,
    localStoragePath: tmpRoot,
    logger,
  });

  await client.start();

  expect(client.stringVariation('string-flag', 'default')).toBe('default');
  expect(client.boolVariation('my-boolean-flag', true)).toBe(true);
});
