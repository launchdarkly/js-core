import { AutoEnvAttributes, clone, LDContext } from '@launchdarkly/js-sdk-common';
import {
  basicPlatform,
  hasher,
  logger,
  setupMockStreamingProcessor,
} from '@launchdarkly/private-js-mocks';

import LDEmitter from './api/LDEmitter';
import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';
import { Flags } from './types';

import useFakeTimers = jest.useFakeTimers;

jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');
  const actualMock = jest.requireActual('@launchdarkly/private-js-mocks');
  return {
    ...actual,
    ...{
      internal: {
        ...actual.internal,
        StreamingProcessor: actualMock.MockStreamingProcessor,
      },
    },
  };
});

const testSdkKey = 'test-sdk-key';
const context: LDContext = { kind: 'org', key: 'Testy Pizza' };

let ldc: LDClientImpl;
let emitter: LDEmitter;
let defaultPutResponse: Flags;

describe('sdk-client object', () => {
  beforeEach(() => {
    defaultPutResponse = clone<Flags>(mockResponseJson);
    // setupMockStreamingProcessor(false, defaultPutResponse);
    basicPlatform.crypto.randomUUID.mockReturnValue('random1');
    hasher.digest.mockReturnValue('digested1');

    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, basicPlatform, {
      logger,
      sendEvents: false,
    });
    jest
      .spyOn(LDClientImpl.prototype as any, 'createStreamUriPath')
      .mockReturnValue('/stream/path');
    // @ts-ignore
    emitter = ldc.emitter;
    jest.spyOn(emitter as LDEmitter, 'emit');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('variation', async () => {
    await ldc.identify(context);
    const devTestFlag = ldc.variation('dev-test-flag');

    expect(devTestFlag).toBe(true);
  });

  test.only('variation flag not found', async () => {
    setupMockStreamingProcessor(false, defaultPutResponse, undefined, undefined, 0, false);
    // HACK: set context manually to pass validation
    ldc.context = { kind: 'user', key: 'test-old-user' };

    const p = ldc.identify(context);

    // GOTCHA: give ldc a chance to hook up with emitter.
    setTimeout(() => {
      ldc.variation('does-not-exist', 'not-found');
    });

    // TODO: this should pass
    await expect(p).resolves.toBeUndefined();
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
    // @ts-ignore
    ldc.flags['dev-test-flag'].deleted = true;
    const flag = ldc.variationDetail('dev-test-flag', 'deleted');

    expect(flag).toEqual({
      reason: { errorKind: 'FLAG_NOT_FOUND', kind: 'ERROR' },
      value: 'deleted',
      variationIndex: null,
    });
  });
});
