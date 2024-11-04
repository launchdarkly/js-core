import {
  AutoEnvAttributes,
  clone,
  Context,
  LDContext,
  LDLogger,
} from '@launchdarkly/js-sdk-common';

import LDClientImpl from '../src/LDClientImpl';
import { Flags } from '../src/types';
import { createBasicPlatform } from './createBasicPlatform';
import * as mockResponseJson from './evaluation/mockResponse.json';
import { MockEventSource } from './streaming/LDClientImpl.mocks';
import { makeTestDataManagerFactory } from './TestDataManager';

let mockPlatform: ReturnType<typeof createBasicPlatform>;
let logger: LDLogger;

beforeEach(() => {
  mockPlatform = createBasicPlatform();
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});

const testSdkKey = 'test-sdk-key';
const context: LDContext = { kind: 'org', key: 'Testy Pizza' };

let ldc: LDClientImpl;
let mockEventSource: MockEventSource;
let simulatedEvents: { data?: any }[] = [];
let defaultPutResponse: Flags;

describe('sdk-client object', () => {
  beforeEach(() => {
    defaultPutResponse = clone<Flags>(mockResponseJson);

    simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];
    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateEvents('put', simulatedEvents);
        return mockEventSource;
      },
    );

    ldc = new LDClientImpl(
      testSdkKey,
      AutoEnvAttributes.Disabled,
      mockPlatform,
      {
        logger,
        sendEvents: false,
      },
      makeTestDataManagerFactory(testSdkKey, mockPlatform),
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('variation', async () => {
    await ldc.identify(context);
    const devTestFlag = ldc.variation('dev-test-flag');
    expect(devTestFlag).toBe(true);
  });

  test('variation flag not found', async () => {
    await ldc.identify({ kind: 'user', key: 'test-user' });
    const errorListener = jest.fn().mockName('errorListener');
    ldc.on('error', errorListener);

    const p = ldc.identify(context);
    ldc.variation('does-not-exist', 'not-found');

    await expect(p).resolves.toBeUndefined();
    expect(errorListener).toHaveBeenCalledTimes(1);
    const error = errorListener.mock.calls[0][1];
    expect(error.message).toMatch(/unknown feature/i);
  });

  test('variationDetail flag not found', async () => {
    await ldc.identify(context);
    const flag = ldc.variationDetail('does-not-exist', 'not-found');

    expect(flag).toEqual({
      reason: { errorKind: 'FLAG_NOT_FOUND', kind: 'ERROR' },
      value: 'not-found',
      variationIndex: null,
    });
  });

  test('variationDetail deleted flag not found', async () => {
    await ldc.identify(context);

    const checkedContext = Context.fromLDContext(context);

    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    await ldc._flagManager.upsert(checkedContext, 'dev-test-flag', {
      version: 999,
      flag: {
        deleted: true,
        version: 0,
        flagVersion: 0,
        value: undefined,
        variation: 0,
        trackEvents: false,
      },
    });
    const flag = ldc.variationDetail('dev-test-flag', 'deleted');

    expect(flag).toEqual({
      reason: { errorKind: 'FLAG_NOT_FOUND', kind: 'ERROR' },
      value: 'deleted',
      variationIndex: null,
    });
  });
});
