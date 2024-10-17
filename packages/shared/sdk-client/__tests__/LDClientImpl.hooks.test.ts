import { AutoEnvAttributes } from '@launchdarkly/js-sdk-common';

import { Hook, HookMetadata } from '../src/api';
import LDClientImpl from '../src/LDClientImpl';
import { createBasicPlatform } from './createBasicPlatform';
import * as mockResponseJson from './evaluation/mockResponse.json';
import { MockEventSource } from './streaming/LDClientImpl.mocks';
import { makeTestDataManagerFactory } from './TestDataManager';

it('should use hooks registered during configuration', async () => {
  const testHook: Hook = {
    beforeEvaluation: jest.fn(),
    afterEvaluation: jest.fn(),
    beforeIdentify: jest.fn(),
    afterIdentify: jest.fn(),
    getMetadata(): HookMetadata {
      return {
        name: 'test hook',
      };
    },
  };

  const platform = createBasicPlatform();
  const factory = makeTestDataManagerFactory('sdk-key', platform, {
    disableNetwork: true,
  });
  const client = new LDClientImpl(
    'sdk-key',
    AutoEnvAttributes.Disabled,
    platform,
    {
      sendEvents: false,
      hooks: [testHook],
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    },
    factory,
  );

  await client.identify({ key: 'user-key' });
  await client.variation('flag-key', false);

  expect(testHook.beforeIdentify).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, timeout: undefined },
    {},
  );
  expect(testHook.afterIdentify).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, timeout: undefined },
    {},
    { status: 'completed' },
  );
  expect(testHook.beforeEvaluation).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, defaultValue: false, flagKey: 'flag-key' },
    {},
  );
  expect(testHook.afterEvaluation).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, defaultValue: false, flagKey: 'flag-key' },
    {},
    {
      reason: {
        errorKind: 'FLAG_NOT_FOUND',
        kind: 'ERROR',
      },
      value: false,
      variationIndex: null,
    },
  );
});

it('should execute hooks that are added using addHook', async () => {
  const platform = createBasicPlatform();
  const factory = makeTestDataManagerFactory('sdk-key', platform, {
    disableNetwork: true,
  });
  const client = new LDClientImpl(
    'sdk-key',
    AutoEnvAttributes.Disabled,
    platform,
    {
      sendEvents: false,
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    },
    factory,
  );

  const addedHook: Hook = {
    beforeEvaluation: jest.fn(),
    afterEvaluation: jest.fn(),
    beforeIdentify: jest.fn(),
    afterIdentify: jest.fn(),
    getMetadata(): HookMetadata {
      return {
        name: 'added hook',
      };
    },
  };

  client.addHook(addedHook);

  await client.identify({ key: 'user-key' });
  await client.variation('flag-key', false);

  expect(addedHook.beforeIdentify).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, timeout: undefined },
    {},
  );
  expect(addedHook.afterIdentify).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, timeout: undefined },
    {},
    { status: 'completed' },
  );
  expect(addedHook.beforeEvaluation).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, defaultValue: false, flagKey: 'flag-key' },
    {},
  );
  expect(addedHook.afterEvaluation).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, defaultValue: false, flagKey: 'flag-key' },
    {},
    {
      reason: {
        errorKind: 'FLAG_NOT_FOUND',
        kind: 'ERROR',
      },
      value: false,
      variationIndex: null,
    },
  );
});

it('should execute both initial hooks and hooks added using addHook', async () => {
  const initialHook: Hook = {
    beforeEvaluation: jest.fn(),
    afterEvaluation: jest.fn(),
    beforeIdentify: jest.fn(),
    afterIdentify: jest.fn(),
    getMetadata(): HookMetadata {
      return {
        name: 'initial hook',
      };
    },
  };

  const platform = createBasicPlatform();
  const factory = makeTestDataManagerFactory('sdk-key', platform, {
    disableNetwork: true,
  });
  const client = new LDClientImpl(
    'sdk-key',
    AutoEnvAttributes.Disabled,
    platform,
    {
      sendEvents: false,
      hooks: [initialHook],
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    },
    factory,
  );

  const addedHook: Hook = {
    beforeEvaluation: jest.fn(),
    afterEvaluation: jest.fn(),
    beforeIdentify: jest.fn(),
    afterIdentify: jest.fn(),
    getMetadata(): HookMetadata {
      return {
        name: 'added hook',
      };
    },
  };

  client.addHook(addedHook);

  await client.identify({ key: 'user-key' });
  await client.variation('flag-key', false);

  // Check initial hook
  expect(initialHook.beforeIdentify).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, timeout: undefined },
    {},
  );
  expect(initialHook.afterIdentify).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, timeout: undefined },
    {},
    { status: 'completed' },
  );
  expect(initialHook.beforeEvaluation).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, defaultValue: false, flagKey: 'flag-key' },
    {},
  );
  expect(initialHook.afterEvaluation).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, defaultValue: false, flagKey: 'flag-key' },
    {},
    {
      reason: {
        errorKind: 'FLAG_NOT_FOUND',
        kind: 'ERROR',
      },
      value: false,
      variationIndex: null,
    },
  );

  // Check added hook
  expect(addedHook.beforeIdentify).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, timeout: undefined },
    {},
  );
  expect(addedHook.afterIdentify).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, timeout: undefined },
    {},
    { status: 'completed' },
  );
  expect(addedHook.beforeEvaluation).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, defaultValue: false, flagKey: 'flag-key' },
    {},
  );
  expect(addedHook.afterEvaluation).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, defaultValue: false, flagKey: 'flag-key' },
    {},
    {
      reason: {
        errorKind: 'FLAG_NOT_FOUND',
        kind: 'ERROR',
      },
      value: false,
      variationIndex: null,
    },
  );
});

it('should not execute hooks for prerequisite evaluations', async () => {
  const testHook: Hook = {
    beforeEvaluation: jest.fn(),
    afterEvaluation: jest.fn(),
    beforeIdentify: jest.fn(),
    afterIdentify: jest.fn(),
    getMetadata(): HookMetadata {
      return {
        name: 'test hook',
      };
    },
  };

  const platform = createBasicPlatform();
  let mockEventSource: MockEventSource;
  const simulatedEvents = [{ data: JSON.stringify(mockResponseJson) }];
  platform.requests.createEventSource.mockImplementation(
    (streamUri: string = '', options: any = {}) => {
      mockEventSource = new MockEventSource(streamUri, options);
      mockEventSource.simulateEvents('put', simulatedEvents);
      return mockEventSource;
    },
  );

  const factory = makeTestDataManagerFactory('sdk-key', platform);
  const client = new LDClientImpl(
    'sdk-key',
    AutoEnvAttributes.Disabled,
    platform,
    {
      sendEvents: false,
      hooks: [testHook],
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    },
    factory,
  );

  await client.identify({ key: 'user-key' });
  await client.variation('has-prereq-depth-1', false);

  expect(testHook.beforeEvaluation).toHaveBeenCalledTimes(1);

  expect(testHook.beforeEvaluation).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, defaultValue: false, flagKey: 'has-prereq-depth-1' },
    {},
  );

  expect(testHook.afterEvaluation).toHaveBeenCalledTimes(1);

  expect(testHook.afterEvaluation).toHaveBeenCalledWith(
    { context: { key: 'user-key' }, defaultValue: false, flagKey: 'has-prereq-depth-1' },
    {},
    {
      reason: {
        kind: 'FALLTHROUGH',
      },
      value: true,
      variationIndex: 0,
    },
  );
});
