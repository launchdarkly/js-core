import { AutoEnvAttributes, clone, Hasher, LDLogger } from '@launchdarkly/js-sdk-common';

import { LDContext } from '../src/api/LDContext';
import LDClientImpl from '../src/LDClientImpl';
import { Flags } from '../src/types';
import { createBasicPlatform } from './createBasicPlatform';
import * as mockResponseJson from './evaluation/mockResponse.json';
import { goodBootstrapData, goodBootstrapDataWithReasons } from './flag-manager/testBootstrapData';
import { MockEventSource } from './streaming/LDClientImpl.mocks';
import { makeTestDataManagerFactory } from './TestDataManager';

const testSdkKey = 'test-sdk-key';
const context: LDContext = { kind: 'user', key: 'test-user' };

let clients: LDClientImpl[] = [];

function setupClient(
  mockPlatform: ReturnType<typeof createBasicPlatform>,
  options?: {
    logger?: LDLogger;
    requiresStart?: boolean;
    disableNetwork?: boolean;
    sendEvents?: boolean;
  },
) {
  const logger = options?.logger ?? {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const ldc = new LDClientImpl(
    testSdkKey,
    AutoEnvAttributes.Disabled,
    mockPlatform,
    {
      logger,
      sendEvents: options?.sendEvents ?? false,
    },
    makeTestDataManagerFactory(testSdkKey, mockPlatform, {
      disableNetwork: options?.disableNetwork,
    }),
    {
      getImplementationHooks: () => [],
      credentialType: 'clientSideId',
      requiresStart: options?.requiresStart ?? true,
    },
  );

  clients.push(ldc);
  return { ldc, logger };
}

function setupStreamingPlatform() {
  const mockPlatform = createBasicPlatform();
  const defaultPutResponse = clone<Flags>(mockResponseJson);
  mockPlatform.crypto.randomUUID.mockReturnValue('random1');
  const hasher = {
    update: jest.fn((): Hasher => hasher),
    digest: jest.fn(() => 'digested1'),
  };
  mockPlatform.crypto.createHash.mockReturnValue(hasher);
  mockPlatform.requests.getEventSourceCapabilities.mockImplementation(() => ({
    readTimeout: true,
    headers: true,
    customMethod: true,
  }));
  mockPlatform.requests.createEventSource.mockImplementation(
    (streamUri: string = '', options: any = {}) => {
      const mockEventSource = new MockEventSource(streamUri, options);
      mockEventSource.simulateEvents('put', [{ data: JSON.stringify(defaultPutResponse) }]);
      return mockEventSource;
    },
  );
  return mockPlatform;
}

describe('LDClientImpl.start()', () => {
  afterEach(async () => {
    await Promise.all(clients.map((c) => c.close()));
    clients = [];
    jest.resetAllMocks();
  });

  it('returns failed status when initial context is not set', async () => {
    const mockPlatform = setupStreamingPlatform();
    const { ldc } = setupClient(mockPlatform);

    const result = await ldc.start();
    expect(result).toEqual({
      status: 'failed',
      error: expect.any(Error),
    });
  });

  it('returns the same promise when called multiple times', async () => {
    const mockPlatform = setupStreamingPlatform();
    const { ldc } = setupClient(mockPlatform);
    ldc.setInitialContext(context);

    const promise1 = ldc.start();
    const promise2 = ldc.start();
    const promise3 = ldc.start();

    expect(promise1).toBe(promise2);
    expect(promise2).toBe(promise3);

    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
    expect(result1.status).toBe('complete');
  });

  it('returns cached result after initialization completes', async () => {
    const mockPlatform = setupStreamingPlatform();
    const { ldc } = setupClient(mockPlatform);
    ldc.setInitialContext(context);

    const result1 = await ldc.start();
    expect(result1.status).toBe('complete');

    const result2 = await ldc.start();
    expect(result2.status).toBe('complete');
  });

  it('resolves with complete status on successful identify', async () => {
    const mockPlatform = setupStreamingPlatform();
    const { ldc } = setupClient(mockPlatform);
    ldc.setInitialContext(context);

    const result = await ldc.start();
    expect(result.status).toBe('complete');
  });

  it('sets the active context after start completes', async () => {
    const mockPlatform = setupStreamingPlatform();
    const { ldc } = setupClient(mockPlatform);
    ldc.setInitialContext(context);

    expect(ldc.getContext()).toBeUndefined();
    await ldc.start();
    expect(ldc.getContext()).toEqual(context);
  });

  describe('bootstrap data', () => {
    it('presets flags from bootstrap in identifyOptions', async () => {
      const mockPlatform = createBasicPlatform();
      const { ldc } = setupClient(mockPlatform, { disableNetwork: true });
      ldc.setInitialContext(context);

      await ldc.start({
        identifyOptions: { bootstrap: goodBootstrapData },
      });

      const flags = ldc.allFlags();
      expect(flags.killswitch).toBe(true);
      expect(flags['string-flag']).toBe('is bob');
      expect(flags.cat).toBe(false);
    });

    it('presets flags from top-level bootstrap option', async () => {
      const mockPlatform = createBasicPlatform();
      const { ldc } = setupClient(mockPlatform, { disableNetwork: true });
      ldc.setInitialContext(context);

      await ldc.start({ bootstrap: goodBootstrapData });

      const flags = ldc.allFlags();
      expect(flags.killswitch).toBe(true);
      expect(flags['string-flag']).toBe('is bob');
    });

    it('makes flags available synchronously before identify completes', async () => {
      const mockPlatform = createBasicPlatform();
      const { ldc } = setupClient(mockPlatform, { disableNetwork: true });
      ldc.setInitialContext(context);

      const startPromise = ldc.start({
        identifyOptions: { bootstrap: goodBootstrapDataWithReasons },
      });

      const flags = ldc.allFlags();
      expect(flags['string-flag']).toBe('is bob');
      expect(flags.killswitch).toBe(true);

      await startPromise;
    });

    it('supports bootstrap data with evaluation reasons', async () => {
      const mockPlatform = createBasicPlatform();
      const { ldc } = setupClient(mockPlatform, { disableNetwork: true });
      ldc.setInitialContext(context);

      await ldc.start({
        identifyOptions: { bootstrap: goodBootstrapDataWithReasons },
      });

      expect(ldc.jsonVariationDetail('json', undefined)).toEqual({
        reason: { kind: 'OFF' },
        value: ['a', 'b', 'c', 'd'],
        variationIndex: 1,
      });
    });

    it('prefers identifyOptions.bootstrap over top-level bootstrap', async () => {
      const mockPlatform = createBasicPlatform();
      const { ldc } = setupClient(mockPlatform, { disableNetwork: true });
      ldc.setInitialContext(context);

      const differentBootstrap = {
        'other-flag': true,
        $flagsState: { 'other-flag': { variation: 0, version: 1 } },
        $valid: true,
      };

      await ldc.start({
        bootstrap: goodBootstrapData,
        identifyOptions: { bootstrap: differentBootstrap },
      });

      const flags = ldc.allFlags();
      expect(flags['other-flag']).toBe(true);
      expect(flags.killswitch).toBeUndefined();
    });
  });

  describe('requiresStart guard', () => {
    it('blocks identify before start when requiresStart is true', async () => {
      const mockPlatform = setupStreamingPlatform();
      const { ldc, logger } = setupClient(mockPlatform, { requiresStart: true });
      ldc.setInitialContext(context);

      const result = await ldc.identifyResult({ kind: 'user', key: 'other-user' });

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toBe('Identify called before start');
      }
      expect(logger.error).toHaveBeenCalledWith(
        'The client must be started before a context can be identified. Call start() prior to identifying a context.',
      );
    });

    it('allows identify after start when requiresStart is true', async () => {
      const mockPlatform = setupStreamingPlatform();
      const { ldc } = setupClient(mockPlatform, { requiresStart: true });
      ldc.setInitialContext(context);

      await ldc.start();

      const result = await ldc.identifyResult({ kind: 'user', key: 'other-user' });
      expect(result.status).toBe('completed');
    });

    it('allows identify without start when requiresStart is false', async () => {
      const mockPlatform = setupStreamingPlatform();
      const { ldc } = setupClient(mockPlatform, { requiresStart: false });

      const result = await ldc.identifyResult(context);
      expect(result.status).toBe('completed');
    });

    it('defaults sheddable to true for post-start identifies when requiresStart is true', async () => {
      const mockPlatform = setupStreamingPlatform();
      const { ldc } = setupClient(mockPlatform, { requiresStart: true });
      ldc.setInitialContext(context);

      const startPromise = ldc.start();
      const promise1 = ldc.identifyResult({ kind: 'user', key: 'user-1' });
      const promise2 = ldc.identifyResult({ kind: 'user', key: 'user-2' });
      const promise3 = ldc.identifyResult({ kind: 'user', key: 'user-3' });

      const [startResult, result1, result2, result3] = await Promise.all([
        startPromise,
        promise1,
        promise2,
        promise3,
      ]);

      expect(startResult.status).toBe('complete');
      expect(result1.status).toBe('shed');
      expect(result2.status).toBe('shed');
      expect(result3.status).toBe('completed');
    });

    it('does not default sheddable when requiresStart is false', async () => {
      const mockPlatform = setupStreamingPlatform();
      const { ldc } = setupClient(mockPlatform, { requiresStart: false });

      const promise1 = ldc.identifyResult({ kind: 'user', key: 'user-1' });
      const promise2 = ldc.identifyResult({ kind: 'user', key: 'user-2' });
      const promise3 = ldc.identifyResult({ kind: 'user', key: 'user-3' });

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      expect(result1.status).toBe('completed');
      expect(result2.status).toBe('completed');
      expect(result3.status).toBe('completed');
    });
  });

  describe('waitForInitialization integration', () => {
    it('resolves waitForInitialization when start completes', async () => {
      const mockPlatform = setupStreamingPlatform();
      const { ldc } = setupClient(mockPlatform);
      ldc.setInitialContext(context);

      const waitPromise = ldc.waitForInitialization({ timeout: 10 });
      const startPromise = ldc.start();

      const [waitResult, startResult] = await Promise.all([waitPromise, startPromise]);

      expect(waitResult.status).toBe('complete');
      expect(startResult.status).toBe('complete');
    });
  });
});
