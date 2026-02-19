import { AutoEnvAttributes, LDLogger } from '@launchdarkly/js-client-sdk-common';

import PlatformCrypto from '../src/platform/crypto';
import PlatformEncoding from '../src/platform/PlatformEncoding';
import PlatformInfo from '../src/platform/PlatformInfo';
import PlatformStorage from '../src/platform/PlatformStorage';
import ReactNativeLDClient from '../src/ReactNativeLDClient';

jest.mock('../src/platform', () => ({
  __esModule: true,
  default: jest.fn((logger: LDLogger) => ({
    crypto: new PlatformCrypto(),
    info: new PlatformInfo(logger, {}),
    requests: {
      createEventSource: jest.fn(),
      fetch: jest.fn(),
      getEventSourceCapabilities: jest.fn(),
    },
    encoding: new PlatformEncoding(),
    storage: new PlatformStorage(logger),
  })),
}));

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

const goodBootstrapDataWithReasons = {
  'string-flag': 'is bob',
  'my-boolean-flag': false,
  json: ['a', 'b', 'c', 'd'],
  $flagsState: {
    'string-flag': {
      variation: 1,
      version: 3,
      reason: { kind: 'OFF' },
    },
    'my-boolean-flag': {
      variation: 1,
      version: 11,
      reason: { kind: 'OFF' },
    },
    json: {
      variation: 1,
      version: 3,
      reason: { kind: 'OFF' },
    },
  },
  $valid: true,
};

describe('ReactNativeLDClient bootstrap', () => {
  let logger: LDLogger;

  beforeEach(() => {
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('can use bootstrap data with identify', async () => {
    const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled, {
      sendEvents: false,
      initialConnectionMode: 'offline',
      logger,
    });

    await client.identify(
      { kind: 'user', key: 'bob' },
      { bootstrap: goodBootstrapDataWithReasons },
    );

    expect(client.jsonVariationDetail('json', undefined)).toEqual({
      reason: { kind: 'OFF' },
      value: ['a', 'b', 'c', 'd'],
      variationIndex: 1,
    });
  });

  it('can evaluate string and boolean flags from bootstrap data', async () => {
    const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled, {
      sendEvents: false,
      initialConnectionMode: 'offline',
      logger,
    });

    await client.identify({ kind: 'user', key: 'bob' }, { bootstrap: goodBootstrapData });

    expect(client.stringVariation('string-flag', 'default')).toBe('is bob');
    expect(client.boolVariation('my-boolean-flag', true)).toBe(false);
  });

  it('uses the latest bootstrap data when re-identifying with new bootstrap data', async () => {
    const newBootstrapData = {
      'string-flag': 'is alice',
      'my-boolean-flag': true,
      $flagsState: {
        'string-flag': {
          variation: 1,
          version: 4,
        },
        'my-boolean-flag': {
          variation: 0,
          version: 12,
        },
      },
      $valid: true,
    };

    const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled, {
      sendEvents: false,
      initialConnectionMode: 'offline',
      logger,
    });

    await client.identify({ kind: 'user', key: 'bob' }, { bootstrap: goodBootstrapData });

    expect(client.stringVariation('string-flag', 'default')).toBe('is bob');
    expect(client.boolVariation('my-boolean-flag', false)).toBe(false);

    await client.identify({ kind: 'user', key: 'alice' }, { bootstrap: newBootstrapData });

    expect(client.stringVariation('string-flag', 'default')).toBe('is alice');
    expect(client.boolVariation('my-boolean-flag', false)).toBe(true);
  });

  it('returns defaults when no bootstrap data is provided', async () => {
    const client = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled, {
      sendEvents: false,
      initialConnectionMode: 'offline',
      logger,
    });

    await client.identify({ kind: 'user', key: 'bob' });

    expect(client.stringVariation('string-flag', 'default')).toBe('default');
    expect(client.boolVariation('my-boolean-flag', true)).toBe(true);
  });
});
