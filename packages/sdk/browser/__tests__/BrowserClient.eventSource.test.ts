import { AutoEnvAttributes, LDLogger } from '@launchdarkly/js-client-sdk-common';

import { makeClient } from '../src/BrowserClient';

const mockPlatformConstructor = jest.fn();

jest.mock('../src/platform/BrowserPlatform', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((logger, options, storage, eventSourceFactory) => {
    mockPlatformConstructor(logger, options, storage, eventSourceFactory);
    const { makeBasicPlatform } = require('./BrowserClient.mocks');
    const platform = makeBasicPlatform(options);
    return platform;
  }),
}));

let logger: LDLogger;

beforeEach(() => {
  jest.clearAllMocks();
  logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
});

function getWiredEventSource() {
  return mockPlatformConstructor.mock.calls[0][3];
}

it('passes a valid event source factory through to the platform unchanged', () => {
  const eventSource = { createEventSource: jest.fn() };

  makeClient('client-side-id', { key: 'user-key', kind: 'user' }, AutoEnvAttributes.Disabled, {
    streaming: false,
    logger,
    diagnosticOptOut: true,
    eventSource,
  });

  expect(getWiredEventSource()).toBe(eventSource);
  expect(logger.warn).not.toHaveBeenCalled();
});

it('does not pass an event source factory when none is configured', () => {
  makeClient('client-side-id', { key: 'user-key', kind: 'user' }, AutoEnvAttributes.Disabled, {
    streaming: false,
    logger,
    diagnosticOptOut: true,
  });

  expect(getWiredEventSource()).toBeUndefined();
});

it('drops an invalid event source factory and warns', () => {
  makeClient('client-side-id', { key: 'user-key', kind: 'user' }, AutoEnvAttributes.Disabled, {
    streaming: false,
    logger,
    diagnosticOptOut: true,
    // @ts-ignore
    eventSource: 'not an object',
  });

  expect(getWiredEventSource()).toBeUndefined();
  expect(logger.warn).toHaveBeenCalledWith(
    'Config option "eventSource" should be of type object, got string, using default value',
  );
});
