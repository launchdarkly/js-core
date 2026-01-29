import { AutoEnvAttributes, clone, LDContext, LDLogger } from '@launchdarkly/js-sdk-common';

import { toMulti } from '../src/context/addAutoEnv';
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
const carContext: LDContext = { kind: 'car', key: 'test-car' };

let ldc: LDClientImpl;
let mockEventSource: MockEventSource;
let simulatedEvents: { data?: any }[] = [];
let defaultPutResponse: Flags;

const DEFAULT_IDENTIFY_TIMEOUT = 5;

describe('sdk-client identify timeout', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    defaultPutResponse = clone<Flags>(mockResponseJson);

    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateEvents('put', simulatedEvents);
        return mockEventSource;
      },
    );

    ldc = new LDClientImpl(
      testSdkKey,
      AutoEnvAttributes.Enabled,
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

  test('rejects with default timeout of 5s', async () => {
    jest.advanceTimersByTimeAsync(DEFAULT_IDENTIFY_TIMEOUT * 1000).then();
    await expect(ldc.identify(carContext)).rejects.toThrow(/identify timed out/);
    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/identify timed out/));
  });

  test('rejects with custom timeout', async () => {
    const timeout = 15;
    jest.advanceTimersByTimeAsync(timeout * 1000).then();
    await expect(ldc.identify(carContext, { timeout })).rejects.toThrow(/identify timed out/);
  });

  test('resolves with default timeout', async () => {
    // set simulated events to be default response
    simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];

    jest.advanceTimersByTimeAsync(DEFAULT_IDENTIFY_TIMEOUT * 1000).then();

    await expect(ldc.identify(carContext)).resolves.toBeUndefined();

    expect(ldc.getContext()).toEqual(expect.objectContaining(toMulti(carContext)));
    expect(ldc.allFlags()).toEqual({
      'dev-test-flag': true,
      'easter-i-tunes-special': false,
      'easter-specials': 'no specials',
      fdsafdsafdsafdsa: true,
      'has-prereq-depth-1': true,
      'is-prereq': true,
      'log-level': 'warn',
      'moonshot-demo': true,
      test1: 's1',
      'this-is-a-test': true,
    });
  });

  test('resolves with custom timeout', async () => {
    const timeout = 15;

    // set simulated events to be default response
    simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];

    jest.advanceTimersByTimeAsync(timeout).then();

    await expect(ldc.identify(carContext, { timeout })).resolves.toBeUndefined();

    expect(ldc.getContext()).toEqual(expect.objectContaining(toMulti(carContext)));
    expect(ldc.allFlags()).toEqual({
      'dev-test-flag': true,
      'easter-i-tunes-special': false,
      'easter-specials': 'no specials',
      fdsafdsafdsafdsa: true,
      'has-prereq-depth-1': true,
      'is-prereq': true,
      'log-level': 'warn',
      'moonshot-demo': true,
      test1: 's1',
      'this-is-a-test': true,
    });
  });

  test('setting high timeout threshold with internalOptions', async () => {
    const highTimeoutThreshold = 20;

    // set simulated events to be default response
    simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];

    ldc = new LDClientImpl(
      testSdkKey,
      AutoEnvAttributes.Enabled,
      mockPlatform,
      {
        logger,
        sendEvents: false,
      },
      makeTestDataManagerFactory(testSdkKey, mockPlatform),
      { highTimeoutThreshold, getImplementationHooks: () => [], credentialType: 'clientSideId' },
    );
    const customTimeout = 10;
    jest.advanceTimersByTimeAsync(customTimeout * 1000).then();
    await ldc.identify(carContext, { timeout: customTimeout });

    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringMatching(/timeout greater/));
  });

  test('warning when timeout is too high', async () => {
    const highTimeout = 60;

    // set simulated events to be default response
    simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];

    jest.advanceTimersByTimeAsync(highTimeout * 1000).then();

    await ldc.identify(carContext, { timeout: highTimeout });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/timeout greater/));
  });

  test('safe timeout should not warn', async () => {
    // set simulated events to be default response
    simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];

    jest.advanceTimersByTimeAsync(DEFAULT_IDENTIFY_TIMEOUT * 1000).then();

    await ldc.identify(carContext, { timeout: DEFAULT_IDENTIFY_TIMEOUT });

    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringMatching(/timeout greater/));
  });
});

describe('sdk-client waitForInitialization', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    defaultPutResponse = clone<Flags>(mockResponseJson);

    mockPlatform.requests.createEventSource.mockImplementation(
      (streamUri: string = '', options: any = {}) => {
        mockEventSource = new MockEventSource(streamUri, options);
        mockEventSource.simulateEvents('put', simulatedEvents);
        return mockEventSource;
      },
    );

    ldc = new LDClientImpl(
      testSdkKey,
      AutoEnvAttributes.Enabled,
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

  it('blocks until the client is ready when waitForInitialization is called', async () => {
    simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];

    const waitPromise = ldc.waitForInitialization({ timeout: 10 });
    const identifyPromise = ldc.identifyResult(carContext);

    jest.advanceTimersByTimeAsync(DEFAULT_IDENTIFY_TIMEOUT).then();

    await Promise.all([waitPromise, identifyPromise]);

    await expect(waitPromise).resolves.toEqual({ status: 'complete' });
    await expect(identifyPromise).resolves.toEqual({ status: 'completed' });
  });

  it('can call waitForInitialization multiple times', async () => {
    simulatedEvents = [{ data: JSON.stringify(defaultPutResponse) }];

    const waitPromise = ldc.waitForInitialization({ timeout: 10 });
    const identifyPromise = ldc.identifyResult(carContext);

    jest.advanceTimersByTimeAsync(DEFAULT_IDENTIFY_TIMEOUT).then();

    await Promise.all([waitPromise, identifyPromise]);

    await expect(waitPromise).resolves.toEqual({ status: 'complete' });
    await expect(identifyPromise).resolves.toEqual({ status: 'completed' });

    const waitPromise2 = ldc.waitForInitialization({ timeout: 10 });
    await expect(waitPromise2).resolves.toEqual({ status: 'complete' });
  });

  it('resolves waitForInitialization with timeout status when initialization does not complete before the timeout', async () => {
    // set simulated events to be empty so initialization does not complete
    simulatedEvents = [];

    const waitPromise = ldc.waitForInitialization({ timeout: 10 });
    const identifyPromise = ldc.identifyResult(carContext);

    jest.advanceTimersByTimeAsync(10 * 1000 + 1).then();

    await Promise.all([waitPromise, identifyPromise]);

    await expect(waitPromise).resolves.toEqual({ status: 'timeout' });
    await expect(identifyPromise).resolves.toEqual({
      timeout: DEFAULT_IDENTIFY_TIMEOUT,
      status: 'timeout',
    });
  });

  it('resolves waitForInitialization with failed status immediately when identify fails', async () => {
    const errorPlatform = createBasicPlatform();
    const identifyError = new Error('Network error');

    // Mock fetch to reject with an error
    errorPlatform.requests.createEventSource.mockImplementation(() => {
      throw identifyError;
    });

    const errorLdc = new LDClientImpl(
      testSdkKey,
      AutoEnvAttributes.Enabled,
      errorPlatform,
      {
        logger,
        sendEvents: false,
      },
      makeTestDataManagerFactory(testSdkKey, errorPlatform),
    );

    const waitPromise = errorLdc.waitForInitialization({ timeout: 10 });
    const identifyPromise = errorLdc.identifyResult(carContext);

    // Advance timers to allow error handler to be set up and error to propagate
    await jest.advanceTimersByTimeAsync(DEFAULT_IDENTIFY_TIMEOUT);
    jest.runAllTicks();

    const identifyResult = await identifyPromise;

    expect(identifyResult.status).toBe('error');

    // Verify that waitForInitialization returns immediately with failed status
    await expect(waitPromise).resolves.toEqual({
      status: 'failed',
      error: identifyError,
    });
  });
});
