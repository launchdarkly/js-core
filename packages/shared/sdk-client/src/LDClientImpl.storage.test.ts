import { clone, type LDContext, LDFlagChangeset } from '@launchdarkly/js-sdk-common';
import { basicPlatform, logger, setupMockStreamingProcessor } from '@launchdarkly/private-js-mocks';

import LDEmitter from './api/LDEmitter';
import * as mockResponseJson from './evaluation/mockResponse.json';
import LDClientImpl from './LDClientImpl';

jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');
  const { MockStreamingProcessor: mockStreamer } = jest.requireActual(
    '@launchdarkly/private-js-mocks',
  );
  return {
    ...actual,
    ...{
      internal: {
        ...actual.internal,
        StreamingProcessor: mockStreamer,
      },
    },
  };
});
describe('sdk-client storage', () => {
  const testSdkKey = 'test-sdk-key';
  const context: LDContext = { kind: 'org', key: 'Testy Pizza' };
  let ldc: LDClientImpl;
  let emitter: LDEmitter;

  beforeEach(() => {
    jest.useFakeTimers();
    setupMockStreamingProcessor(false, mockResponseJson);
    basicPlatform.storage.get.mockImplementation(() => JSON.stringify(mockResponseJson));
    jest
      .spyOn(LDClientImpl.prototype as any, 'createStreamUriPath')
      .mockReturnValue('/stream/path');
    // jest.spyOn(LDEmitter.prototype as any, 'emit');

    ldc = new LDClientImpl(testSdkKey, basicPlatform, { logger, sendEvents: false });

    // @ts-ignore
    emitter = ldc.emitter;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('initialize from storage succeeds without streamer', async () => {
    // make sure streamer errors
    setupMockStreamingProcessor(true);

    try {
      await ldc.identify(context);
    } catch (e) {}
    const all = ldc.allFlags();

    expect(basicPlatform.storage.get).toHaveBeenCalledWith('org:Testy Pizza');
    // expect(emitter.emit).toHaveBeenNthCalledWith(1, 'initializing', context);
    // expect(emitter.emit).toHaveBeenNthCalledWith(2, 'ready', context);
    expect(all).toEqual({
      'dev-test-flag': true,
      'easter-i-tunes-special': false,
      'easter-specials': 'no specials',
      fdsafdsafdsafdsa: true,
      'log-level': 'warn',
      'moonshot-demo': true,
      test1: 's1',
      'this-is-a-test': true,
    });
  });

  test('sync deleted', async () => {
    const putResponse = clone(mockResponseJson);
    delete putResponse['dev-test-flag'];
    setupMockStreamingProcessor(false, putResponse);

    let changes: LDFlagChangeset;
    ldc.on('change', (_context: LDContext, changeset: LDFlagChangeset) => {
      changes = changeset;
    });

    try {
      await ldc.identify(context);
    } catch (e) {}
    jest.runAllTicks();
    const all = ldc.allFlags();

    expect(all).not.toContain('dev-test-flag');
    expect(basicPlatform.storage.set).toHaveBeenCalledWith(
      'org:Testy Pizza',
      JSON.stringify(putResponse),
    );

    // TODO: test deleted changeset from emitter
    // @ts-ignore
    // expect(changes).toEqual({});

    // expect(emitter.emit).toHaveBeenNthCalledWith(1, 'initializing', context);
    // expect(emitter.emit).toHaveBeenNthCalledWith(2, 'ready', context);
    // expect(emitter.emit).toHaveBeenNthCalledWith(3, 'change', context, {
    //   'dev-test-flag': { previous: true },
    // });
  });
});
