import { AsyncQueue } from 'launchdarkly-js-test-helpers';

import { AutoEnvAttributes, clone } from '@launchdarkly/js-sdk-common';

import { LDInspection } from '../src/api/LDInspection';
import LDClientImpl from '../src/LDClientImpl';
import { Flags, PatchFlag } from '../src/types';
import { createBasicPlatform } from './createBasicPlatform';
import * as mockResponseJson from './evaluation/mockResponse.json';
import { MockEventSource } from './streaming/LDClientImpl.mocks';
import { makeTestDataManagerFactory } from './TestDataManager';

it('calls flag-used inspectors', async () => {
  const flagUsedInspector: LDInspection = {
    type: 'flag-used',
    name: 'test flag used inspector',
    method: jest.fn(),
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
      inspectors: [flagUsedInspector],
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

  expect(flagUsedInspector.method).toHaveBeenCalledWith(
    'flag-key',
    {
      value: false,
      variationIndex: null,
      reason: {
        kind: 'ERROR',
        errorKind: 'FLAG_NOT_FOUND',
      },
    },
    { key: 'user-key' },
  );
});

it('calls client-identity-changed inspectors', async () => {
  const identifyInspector: LDInspection = {
    type: 'client-identity-changed',
    name: 'test client identity inspector',
    method: jest.fn(),
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
      inspectors: [identifyInspector],
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

  expect(identifyInspector.method).toHaveBeenCalledWith({ key: 'user-key' });
});

it('calls flag-detail-changed inspector for individial flag changes on patch', async () => {
  const eventQueue = new AsyncQueue();
  const flagDetailChangedInspector: LDInspection = {
    type: 'flag-detail-changed',
    name: 'test flag detail changed inspector',
    method: jest.fn(() => eventQueue.add({})),
  };
  const platform = createBasicPlatform();
  const factory = makeTestDataManagerFactory('sdk-key', platform);
  const client = new LDClientImpl(
    'sdk-key',
    AutoEnvAttributes.Disabled,
    platform,
    {
      sendEvents: false,
      inspectors: [flagDetailChangedInspector],
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    },
    factory,
  );
  let mockEventSource: MockEventSource;

  const putResponse = clone<Flags>(mockResponseJson);
  const putEvents = [{ data: JSON.stringify(putResponse) }];
  platform.requests.createEventSource.mockImplementation(
    (streamUri: string = '', options: any = {}) => {
      mockEventSource = new MockEventSource(streamUri, options);
      const patchResponse = clone<PatchFlag>(putResponse['dev-test-flag']);
      patchResponse.key = 'dev-test-flag';
      patchResponse.value = false;
      patchResponse.version += 1;
      const patchEvents = [{ data: JSON.stringify(patchResponse) }];

      // @ts-ignore
      mockEventSource.simulateEvents('patch', patchEvents);
      mockEventSource.simulateEvents('put', putEvents);
      return mockEventSource;
    },
  );

  await client.identify({ key: 'user-key' }, { waitForNetworkResults: true });

  await eventQueue.take();
  expect(flagDetailChangedInspector.method).toHaveBeenCalledWith('dev-test-flag', {
    reason: null,
    value: false,
    variationIndex: 0,
  });
});

it('calls flag-details-changed inspectors when all flag values change', async () => {
  const flagDetailsChangedInspector: LDInspection = {
    type: 'flag-details-changed',
    name: 'test flag details changed inspector',
    method: jest.fn(),
  };
  const platform = createBasicPlatform();
  const factory = makeTestDataManagerFactory('sdk-key', platform);
  const client = new LDClientImpl(
    'sdk-key',
    AutoEnvAttributes.Disabled,
    platform,
    {
      sendEvents: false,
      inspectors: [flagDetailsChangedInspector],
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    },
    factory,
  );
  let mockEventSource: MockEventSource;

  platform.requests.createEventSource.mockImplementation(
    (streamUri: string = '', options: any = {}) => {
      mockEventSource = new MockEventSource(streamUri, options);
      const simulatedEvents = [{ data: JSON.stringify(mockResponseJson) }];
      mockEventSource.simulateEvents('put', simulatedEvents);
      return mockEventSource;
    },
  );

  await client.identify({ key: 'user-key' }, { waitForNetworkResults: true });
  expect(flagDetailsChangedInspector.method).toHaveBeenCalledWith({
    'dev-test-flag': { reason: null, value: true, variationIndex: 0 },
    'easter-i-tunes-special': { reason: null, value: false, variationIndex: 1 },
    'easter-specials': { reason: null, value: 'no specials', variationIndex: 3 },
    fdsafdsafdsafdsa: { reason: null, value: true, variationIndex: 0 },
    'log-level': { reason: null, value: 'warn', variationIndex: 3 },
    'moonshot-demo': { reason: null, value: true, variationIndex: 0 },
    test1: { reason: null, value: 's1', variationIndex: 0 },
    'this-is-a-test': { reason: null, value: true, variationIndex: 0 },
    'has-prereq-depth-1': { reason: { kind: 'FALLTHROUGH' }, value: true, variationIndex: 0 },
    'is-prereq': { reason: { kind: 'FALLTHROUGH' }, value: true, variationIndex: 0 },
  });
});
