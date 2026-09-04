import { LDLogger } from '@launchdarkly/js-sdk-common';

import { LDOptions } from '../src/api/options/LDOptions';
import LDClientImpl from '../src/LDClientImpl';
import { createBasicPlatform } from './createBasicPlatform';

describe('given a client using the FDv2 data system', () => {
  const callbacks = {
    onFailed: jest.fn(),
    onError: jest.fn(),
    onReady: jest.fn(),
    onUpdate: jest.fn(),
    hasEventListeners: jest.fn(),
  };
  let platform: any;
  let logger: LDLogger;
  let client: LDClientImpl;

  function makeOptions(overrides: LDOptions = {}): LDOptions {
    return {
      sendEvents: false,
      diagnosticOptOut: true,
      logger,
      dataSystem: {
        dataSource: {
          dataSourceOptionsType: 'custom',
          initializers: [],
          synchronizers: [],
        },
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    platform = createBasicPlatform();
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
  });

  afterEach(() => {
    client?.close();
    jest.resetAllMocks();
  });

  it('warns when a payload filter key is configured', () => {
    client = new LDClientImpl(
      'sdk-key',
      platform,
      makeOptions({ payloadFilterKey: 'microservice-1' }),
      callbacks,
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Payload filtering is not supported with the FDv2 data system'),
    );
  });

  it('does not warn when no payload filter key is configured', () => {
    client = new LDClientImpl('sdk-key', platform, makeOptions(), callbacks);

    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Payload filtering is not supported'),
    );
  });
});
