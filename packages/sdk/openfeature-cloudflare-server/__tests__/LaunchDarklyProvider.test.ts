import type { KVNamespace } from '@cloudflare/workers-types';
import { Client, ErrorCode, OpenFeature, ProviderStatus } from '@openfeature/server-sdk';

import type { LDClient } from '@launchdarkly/cloudflare-server-sdk';
import { translateContext } from '@launchdarkly/openfeature-js-server-common';

import { LaunchDarklyProvider } from '../src';
import TestLogger from './TestLogger';

const basicContext = { targetingKey: 'the-key' };
const testFlagKey = 'a-key';
const clientSideID = 'test-client-side-id';

function makeKvNamespace(): KVNamespace {
  return { get: jest.fn() } as unknown as KVNamespace;
}

it('can be initialized', async () => {
  const ldProvider = new LaunchDarklyProvider(clientSideID, makeKvNamespace());
  await ldProvider.initialize({});

  await OpenFeature.setProviderAndWait(ldProvider);

  const ofClient = OpenFeature.getClient();

  expect(ofClient.providerStatus).toEqual(ProviderStatus.READY);
  await ldProvider.onClose();
});

it('can fail to initialize client', async () => {
  const ldProvider = new LaunchDarklyProvider('', makeKvNamespace());
  try {
    await OpenFeature.setProviderAndWait(ldProvider);
  } catch (e) {
    expect((e as Error).message).toEqual('You must configure the client with a client key');
  }
  const ofClient = OpenFeature.getClient();
  expect(ofClient.providerStatus).toEqual(ProviderStatus.ERROR);
});

describe('given a mock LaunchDarkly client', () => {
  let ldClient: LDClient;
  let ofClient: Client;
  let ldProvider: LaunchDarklyProvider;
  const logger: TestLogger = new TestLogger();

  beforeEach(async () => {
    ldProvider = new LaunchDarklyProvider(clientSideID, makeKvNamespace(), { logger });
    ldClient = ldProvider.getClient();
    await OpenFeature.setProviderAndWait(ldProvider);

    ofClient = OpenFeature.getClient();
    logger.reset();
  });

  afterEach(async () => {
    await ldProvider.onClose();
    jest.restoreAllMocks();
  });

  it('calls the client correctly for boolean variations', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: true,
      reason: {
        kind: 'OFF',
      },
    }));
    await ofClient.getBooleanDetails(testFlagKey, false, basicContext);
    expect(ldClient.variationDetail).toHaveBeenCalledWith(
      testFlagKey,
      translateContext(logger, basicContext),
      false,
    );
    jest.clearAllMocks();
    await ofClient.getBooleanValue(testFlagKey, false, basicContext);
    expect(ldClient.variationDetail).toHaveBeenCalledWith(
      testFlagKey,
      translateContext(logger, basicContext),
      false,
    );
  });

  it('handles correct return types for boolean variations', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: true,
      reason: {
        kind: 'OFF',
      },
    }));
    const res = await ofClient.getBooleanDetails(testFlagKey, false, basicContext);
    expect(res).toMatchObject({
      flagKey: testFlagKey,
      value: true,
      reason: 'DISABLED',
    });
  });

  it('handles incorrect return types for boolean variations', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: 'badness',
      reason: {
        kind: 'OFF',
      },
    }));
    const res = await ofClient.getBooleanDetails(testFlagKey, false, basicContext);
    expect(res).toMatchObject({
      flagKey: testFlagKey,
      value: false,
      reason: 'ERROR',
      errorCode: 'TYPE_MISMATCH',
    });
  });

  it('calls the client correctly for string variations', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: 'test',
      reason: {
        kind: 'OFF',
      },
    }));
    await ofClient.getStringDetails(testFlagKey, 'default', basicContext);
    expect(ldClient.variationDetail).toHaveBeenCalledWith(
      testFlagKey,
      translateContext(logger, basicContext),
      'default',
    );
    jest.clearAllMocks();
    await ofClient.getStringValue(testFlagKey, 'default', basicContext);
    expect(ldClient.variationDetail).toHaveBeenCalledWith(
      testFlagKey,
      translateContext(logger, basicContext),
      'default',
    );
  });

  it('handles correct return types for string variations', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: 'good',
      reason: {
        kind: 'OFF',
      },
    }));
    const res = await ofClient.getStringDetails(testFlagKey, 'default', basicContext);
    expect(res).toMatchObject({
      flagKey: testFlagKey,
      value: 'good',
      reason: 'DISABLED',
    });
  });

  it('handles incorrect return types for string variations', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: true,
      reason: {
        kind: 'OFF',
      },
    }));
    const res = await ofClient.getStringDetails(testFlagKey, 'default', basicContext);
    expect(res).toMatchObject({
      flagKey: testFlagKey,
      value: 'default',
      reason: 'ERROR',
      errorCode: 'TYPE_MISMATCH',
    });
  });

  it('calls the client correctly for numeric variations', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: 8,
      reason: {
        kind: 'OFF',
      },
    }));
    await ofClient.getNumberDetails(testFlagKey, 0, basicContext);
    expect(ldClient.variationDetail).toHaveBeenCalledWith(
      testFlagKey,
      translateContext(logger, basicContext),
      0,
    );
    jest.clearAllMocks();
    await ofClient.getNumberValue(testFlagKey, 0, basicContext);
    expect(ldClient.variationDetail).toHaveBeenCalledWith(
      testFlagKey,
      translateContext(logger, basicContext),
      0,
    );
  });

  it('handles correct return types for numeric variations', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: 17,
      reason: {
        kind: 'OFF',
      },
    }));
    const res = await ofClient.getNumberDetails(testFlagKey, 0, basicContext);
    expect(res).toMatchObject({
      flagKey: testFlagKey,
      value: 17,
      reason: 'DISABLED',
    });
  });

  it('handles incorrect return types for numeric variations', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: true,
      reason: {
        kind: 'OFF',
      },
    }));
    const res = await ofClient.getNumberDetails(testFlagKey, 0, basicContext);
    expect(res).toMatchObject({
      flagKey: testFlagKey,
      value: 0,
      reason: 'ERROR',
      errorCode: 'TYPE_MISMATCH',
    });
  });

  it('calls the client correctly for object variations', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: { yes: 'no' },
      reason: {
        kind: 'OFF',
      },
    }));
    await ofClient.getObjectDetails(testFlagKey, {}, basicContext);
    expect(ldClient.variationDetail).toHaveBeenCalledWith(
      testFlagKey,
      translateContext(logger, basicContext),
      {},
    );
    jest.clearAllMocks();
    await ofClient.getObjectValue(testFlagKey, {}, basicContext);
    expect(ldClient.variationDetail).toHaveBeenCalledWith(
      testFlagKey,
      translateContext(logger, basicContext),
      {},
    );
  });

  it('handles correct return types for object variations', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: { some: 'value' },
      reason: {
        kind: 'OFF',
      },
    }));
    const res = await ofClient.getObjectDetails(testFlagKey, {}, basicContext);
    expect(res).toMatchObject({
      flagKey: testFlagKey,
      value: { some: 'value' },
      reason: 'DISABLED',
    });
  });

  it('handles incorrect return types for object variations', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: 22,
      reason: {
        kind: 'OFF',
      },
    }));
    const res = await ofClient.getObjectDetails(testFlagKey, {}, basicContext);
    expect(res).toMatchObject({
      flagKey: testFlagKey,
      value: {},
      reason: 'ERROR',
      errorCode: 'TYPE_MISMATCH',
    });
  });

  it.each([
    ['CLIENT_NOT_READY', ErrorCode.PROVIDER_NOT_READY],
    ['MALFORMED_FLAG', ErrorCode.PARSE_ERROR],
    ['FLAG_NOT_FOUND', ErrorCode.FLAG_NOT_FOUND],
    ['USER_NOT_SPECIFIED', ErrorCode.TARGETING_KEY_MISSING],
    ['UNSPECIFIED', ErrorCode.GENERAL],
    [undefined, ErrorCode.GENERAL],
  ])('handles errors from the client', async (ldError, ofError) => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: { yes: 'no' },
      reason: {
        kind: 'ERROR',
        errorKind: ldError,
      },
    }));
    const res = await ofClient.getObjectDetails(testFlagKey, { yes: 'no' }, basicContext);
    expect(res).toMatchObject({
      flagKey: testFlagKey,
      value: { yes: 'no' },
      reason: 'ERROR',
      errorCode: ofError,
    });
  });

  it('includes the variant', async () => {
    ldClient.variationDetail = jest.fn(async () => ({
      value: { yes: 'no' },
      variationIndex: 22,
      reason: {
        kind: 'OFF',
      },
    }));
    const res = await ofClient.getObjectDetails(testFlagKey, {}, basicContext);
    expect(res).toMatchObject({
      flagKey: testFlagKey,
      value: { yes: 'no' },
      variant: '22',
      reason: 'DISABLED',
    });
  });

  it('logs information about missing keys', async () => {
    await ofClient.getObjectDetails(testFlagKey, {}, {});
    expect(logger.logs[0]).toEqual(
      "The EvaluationContext must contain either a 'targetingKey' " +
        "or a 'key' and the type must be a string.",
    );
  });

  it('logs information about double keys', async () => {
    await ofClient.getObjectDetails(testFlagKey, {}, { targetingKey: '1', key: '2' });
    expect(logger.logs[0]).toEqual(
      "The EvaluationContext contained both a 'targetingKey' and a" +
        " 'key' attribute. The 'key' attribute will be discarded.",
    );
  });

  it('handles tracking with invalid context', () => {
    ofClient.track('test-event', {});
    expect(logger.logs[0]).toEqual(
      "The EvaluationContext must contain either a 'targetingKey' " +
        "or a 'key' and the type must be a string.",
    );
  });

  it('handles tracking with no data or metricValue', () => {
    ldClient.track = jest.fn();
    ofClient.track('test-event', basicContext);
    expect(ldClient.track).toHaveBeenCalledWith(
      'test-event',
      translateContext(logger, basicContext),
      undefined,
      undefined,
    );
  });

  it('handles tracking with only metricValue', () => {
    ldClient.track = jest.fn();
    ofClient.track('test-event', basicContext, { value: 12345 });
    expect(ldClient.track).toHaveBeenCalledWith(
      'test-event',
      translateContext(logger, basicContext),
      undefined,
      12345,
    );
  });

  it('handles tracking with data but no metricValue', () => {
    ldClient.track = jest.fn();
    ofClient.track('test-event', basicContext, { key1: 'val1' });
    expect(ldClient.track).toHaveBeenCalledWith(
      'test-event',
      translateContext(logger, basicContext),
      { key1: 'val1' },
      undefined,
    );
  });

  it('handles tracking with data and metricValue', () => {
    ldClient.track = jest.fn();
    ofClient.track('test-event', basicContext, { value: 12345, key1: 'val1' });
    expect(ldClient.track).toHaveBeenCalledWith(
      'test-event',
      translateContext(logger, basicContext),
      { key1: 'val1' },
      12345,
    );
  });
});
