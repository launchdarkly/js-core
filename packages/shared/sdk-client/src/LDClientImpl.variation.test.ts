import { AutoEnvAttributes, clone, LDContext } from '@launchdarkly/js-sdk-common';
import { basicPlatform, logger, setupMockStreamingProcessor } from '@launchdarkly/private-js-mocks';

import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';
import { Flags } from './types';

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
let defaultPutResponse: Flags;

describe('sdk-client object', () => {
  beforeEach(() => {
    defaultPutResponse = clone<Flags>(mockResponseJson);
    setupMockStreamingProcessor(false, defaultPutResponse);
    ldc = new LDClientImpl(testSdkKey, AutoEnvAttributes.Enabled, basicPlatform, {
      logger,
      sendEvents: false,
    });
    jest
      .spyOn(LDClientImpl.prototype as any, 'createStreamUriPath')
      .mockReturnValue('/stream/path');
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
    // set context manually to pass validation
    ldc.inputContext = { kind: 'user', key: 'test-user' };
    const errorListener = jest.fn().mockName('errorListener');
    ldc.on('error', errorListener);

    const p = ldc.identify(context);
    setTimeout(() => {
      // call variation in the next tick to give ldc a chance to hook up event emitter
      ldc.variation('does-not-exist', 'not-found');
    });

    await expect(p).resolves.toBeUndefined();
    const error = errorListener.mock.calls[0][1];
    expect(errorListener).toHaveBeenCalledTimes(1);
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

    // the context may have had auto env attributes added to it, so use that context for the
    // upsert
    const checkedContext = ldc.checkedContext

    // @ts-ignore
    await ldc.flagManager.upsert(checkedContext, 'dev-test-flag', {version: 999, flag: {deleted: true}})
    const flag = ldc.variationDetail('dev-test-flag', 'deleted');

    expect(flag).toEqual({
      reason: { errorKind: 'FLAG_NOT_FOUND', kind: 'ERROR' },
      value: 'deleted',
      variationIndex: null,
    });
  });
});
