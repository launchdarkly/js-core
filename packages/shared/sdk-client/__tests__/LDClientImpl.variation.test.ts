import {
  AutoEnvAttributes,
  base64UrlEncode,
  clone,
  Context,
  Encoding,
  internal,
  LDContext,
  LDHeaders,
} from '@launchdarkly/js-sdk-common';
import { createBasicPlatform, createLogger } from '@launchdarkly/private-js-mocks';

import { Configuration } from '../src/configuration/Configuration';
import { FlagManager } from '../src/flag-manager/FlagManager';
import LDClientImpl from '../src/LDClientImpl';
import LDEmitter from '../src/LDEmitter';
import { Flags } from '../src/types';
import * as mockResponseJson from './evaluation/mockResponse.json';
import { MockEventSource } from './streaming/LDClientImpl.mocks';
import TestDataManager from './TestDataManager';

let mockPlatform: ReturnType<typeof createBasicPlatform>;
let logger: ReturnType<typeof createLogger>;

beforeEach(() => {
  mockPlatform = createBasicPlatform();
  logger = createLogger();
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
      (
        flagManager: FlagManager,
        configuration: Configuration,
        baseHeaders: LDHeaders,
        emitter: LDEmitter,
        diagnosticsManager?: internal.DiagnosticsManager,
      ) =>
        new TestDataManager(
          mockPlatform,
          flagManager,
          testSdkKey,
          configuration,
          () => ({
            pathGet(encoding: Encoding, _plainContextString: string): string {
              return `/msdk/evalx/contexts/${base64UrlEncode(_plainContextString, encoding)}`;
            },
            pathReport(_encoding: Encoding, _plainContextString: string): string {
              return `/msdk/evalx/context`;
            },
          }),
          () => ({
            pathGet(_encoding: Encoding, _plainContextString: string): string {
              return '/stream/path';
            },
            pathReport(_encoding: Encoding, _plainContextString: string): string {
              return '/stream/path';
            },
          }),
          baseHeaders,
          emitter,
          diagnosticsManager,
        ),
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
    await ldc.flagManager.upsert(checkedContext, 'dev-test-flag', {
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
