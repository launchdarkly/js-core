import { ErrorCode, ProviderEvents, StandardResolutionReasons } from '@openfeature/server-sdk';

import { BaseOpenFeatureProvider, type BaseProviderConfig } from '../src/BaseOpenFeatureProvider';
import type { OpenFeatureLDClientContract } from '../src/OpenFeatureLDClientContract';
import TestLogger from './TestLogger';

class MockLDClient implements OpenFeatureLDClientContract {
  variationDetail = jest.fn();
  waitForInitialization = jest.fn().mockResolvedValue(undefined);
  flush = jest.fn().mockResolvedValue(undefined);
  close = jest.fn();
  track = jest.fn();
}

class TestProvider extends BaseOpenFeatureProvider {
  constructor(config: BaseProviderConfig, client?: OpenFeatureLDClientContract, error?: unknown) {
    super(config);
    if (error !== undefined) {
      this.setClientError(error);
    } else if (client) {
      this.setClient(client);
    }
  }

  emitChange(flagKey: string) {
    this.emitConfigurationChanged(flagKey);
  }
}

const baseConfig = (logger: TestLogger): BaseProviderConfig => ({
  logger,
  providerName: 'test-provider',
});

it('exposes provider metadata and runsOn', () => {
  const provider = new TestProvider(baseConfig(new TestLogger()), new MockLDClient());
  expect(provider.metadata).toEqual({ name: 'test-provider' });
  expect(provider.runsOn).toEqual('server');
  expect(provider.hooks).toEqual([]);
});

it('initialize forwards the configured timeout to waitForInitialization', async () => {
  const client = new MockLDClient();
  const provider = new TestProvider(
    { logger: new TestLogger(), providerName: 'p', initTimeoutSeconds: 5 },
    client,
  );
  await provider.initialize();
  expect(client.waitForInitialization).toHaveBeenCalledWith({ timeout: 5 });
});

it('initialize defaults the timeout to 10 seconds', async () => {
  const client = new MockLDClient();
  const provider = new TestProvider(baseConfig(new TestLogger()), client);
  await provider.initialize();
  expect(client.waitForInitialization).toHaveBeenCalledWith({ timeout: 10 });
});

it('initialize rethrows the construction error when setClientError was called', async () => {
  const error = new Error('boom');
  const provider = new TestProvider(baseConfig(new TestLogger()), undefined, error);
  await expect(provider.initialize()).rejects.toBe(error);
});

it('initialize throws a generic error when no client and no error were registered', async () => {
  const provider = new TestProvider(baseConfig(new TestLogger()));
  await expect(provider.initialize()).rejects.toThrow('Unknown problem encountered during initialization');
});

it('resolveBooleanEvaluation returns the translated result for boolean flags', async () => {
  const client = new MockLDClient();
  client.variationDetail.mockResolvedValue({
    value: true,
    variationIndex: 1,
    reason: { kind: 'OFF' },
  });
  const provider = new TestProvider(baseConfig(new TestLogger()), client);

  const result = await provider.resolveBooleanEvaluation('flag', false, { targetingKey: 'u' });

  expect(client.variationDetail).toHaveBeenCalledWith(
    'flag',
    { kind: 'user', key: 'u' },
    false,
  );
  expect(result).toEqual({ value: true, variant: '1', reason: 'OFF' });
});

it('resolveStringEvaluation returns the translated result for string flags', async () => {
  const client = new MockLDClient();
  client.variationDetail.mockResolvedValue({
    value: 'green',
    variationIndex: 0,
    reason: { kind: 'FALLTHROUGH' },
  });
  const provider = new TestProvider(baseConfig(new TestLogger()), client);

  const result = await provider.resolveStringEvaluation('flag', 'red', { targetingKey: 'u' });

  expect(result).toEqual({ value: 'green', variant: '0', reason: 'FALLTHROUGH' });
});

it('resolveNumberEvaluation returns the translated result for number flags', async () => {
  const client = new MockLDClient();
  client.variationDetail.mockResolvedValue({
    value: 42,
    variationIndex: 2,
    reason: { kind: 'TARGET_MATCH' },
  });
  const provider = new TestProvider(baseConfig(new TestLogger()), client);

  const result = await provider.resolveNumberEvaluation('flag', 0, { targetingKey: 'u' });

  expect(result).toEqual({ value: 42, variant: '2', reason: 'TARGET_MATCH' });
});

it('resolveObjectEvaluation returns the translated result for object flags', async () => {
  const client = new MockLDClient();
  client.variationDetail.mockResolvedValue({
    value: { a: 1 },
    variationIndex: 3,
    reason: { kind: 'RULE_MATCH' },
  });
  const provider = new TestProvider(baseConfig(new TestLogger()), client);

  const result = await provider.resolveObjectEvaluation<{ a: number }>(
    'flag',
    { a: 0 },
    { targetingKey: 'u' },
  );

  expect(result).toEqual({ value: { a: 1 }, variant: '3', reason: 'RULE_MATCH' });
});

it.each([
  ['boolean', 'resolveBooleanEvaluation', 'not-a-bool', false],
  ['string', 'resolveStringEvaluation', 7, 'fallback'],
  ['number', 'resolveNumberEvaluation', 'not-a-number', 0],
  ['object', 'resolveObjectEvaluation', 'not-an-object', { a: 1 }],
] as const)(
  'returns wrong-type fallback when %s flag has wrong type',
  async (_label, method, returnedValue, defaultValue) => {
    const client = new MockLDClient();
    client.variationDetail.mockResolvedValue({
      value: returnedValue,
      variationIndex: 0,
      reason: { kind: 'OFF' },
    });
    const provider = new TestProvider(baseConfig(new TestLogger()), client);

    const result = await (provider as any)[method]('flag', defaultValue, { targetingKey: 'u' });

    expect(result).toEqual({
      value: defaultValue,
      reason: StandardResolutionReasons.ERROR,
      errorCode: ErrorCode.TYPE_MISMATCH,
    });
  },
);

it('resolveObjectEvaluation returns wrong-type fallback when the SDK value is null', async () => {
  const client = new MockLDClient();
  client.variationDetail.mockResolvedValue({
    value: null,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });
  const provider = new TestProvider(baseConfig(new TestLogger()), client);

  const result = await provider.resolveObjectEvaluation('flag', { a: 1 }, { targetingKey: 'u' });

  expect(result).toEqual({
    value: { a: 1 },
    reason: StandardResolutionReasons.ERROR,
    errorCode: ErrorCode.TYPE_MISMATCH,
  });
});

it.each([
  ['CLIENT_NOT_READY', ErrorCode.PROVIDER_NOT_READY],
  ['MALFORMED_FLAG', ErrorCode.PARSE_ERROR],
  ['FLAG_NOT_FOUND', ErrorCode.FLAG_NOT_FOUND],
  ['USER_NOT_SPECIFIED', ErrorCode.TARGETING_KEY_MISSING],
  ['UNSPECIFIED', ErrorCode.GENERAL],
  [undefined, ErrorCode.GENERAL],
] as const)('translates ERROR-reason errorKind %s into OpenFeature error code', async (errorKind, expectedCode) => {
  const client = new MockLDClient();
  client.variationDetail.mockResolvedValue({
    value: { yes: 'no' },
    reason: { kind: 'ERROR', errorKind },
  });
  const provider = new TestProvider(baseConfig(new TestLogger()), client);

  const result = await provider.resolveObjectEvaluation('flag', { yes: 'no' }, { targetingKey: 'u' });

  expect(result).toMatchObject({
    value: { yes: 'no' },
    reason: 'ERROR',
    errorCode: expectedCode,
  });
});

it('track forwards the translated context, event details, and metric value', () => {
  const client = new MockLDClient();
  const provider = new TestProvider(baseConfig(new TestLogger()), client);

  provider.track(
    'event',
    { targetingKey: 'u', kind: 'user' },
    { value: 1.5, foo: 'bar' },
  );

  expect(client.track).toHaveBeenCalledWith(
    'event',
    { kind: 'user', key: 'u' },
    { foo: 'bar' },
    1.5,
  );
});

it('track passes undefined data when only the value is provided', () => {
  const client = new MockLDClient();
  const provider = new TestProvider(baseConfig(new TestLogger()), client);

  provider.track('event', { targetingKey: 'u' }, { value: 7 });

  expect(client.track).toHaveBeenCalledWith(
    'event',
    { kind: 'user', key: 'u' },
    undefined,
    7,
  );
});

it('track with no event details passes undefined data and undefined metricValue', () => {
  const client = new MockLDClient();
  const provider = new TestProvider(baseConfig(new TestLogger()), client);

  provider.track('event', { targetingKey: 'u' });

  expect(client.track).toHaveBeenCalledWith(
    'event',
    { kind: 'user', key: 'u' },
    undefined,
    undefined,
  );
});

it('track with empty event details passes undefined data and undefined metricValue', () => {
  const client = new MockLDClient();
  const provider = new TestProvider(baseConfig(new TestLogger()), client);

  provider.track('event', { targetingKey: 'u' }, {});

  expect(client.track).toHaveBeenCalledWith(
    'event',
    { kind: 'user', key: 'u' },
    undefined,
    undefined,
  );
});

it('track with data but no metricValue forwards data and undefined metricValue', () => {
  const client = new MockLDClient();
  const provider = new TestProvider(baseConfig(new TestLogger()), client);

  provider.track('event', { targetingKey: 'u' }, { key1: 'val1' });

  expect(client.track).toHaveBeenCalledWith(
    'event',
    { kind: 'user', key: 'u' },
    { key1: 'val1' },
    undefined,
  );
});

it('emits ConfigurationChanged events with the affected flag key', () => {
  const provider = new TestProvider(baseConfig(new TestLogger()), new MockLDClient());
  const handler = jest.fn();
  provider.events.addHandler(ProviderEvents.ConfigurationChanged, handler);

  provider.emitChange('my-flag');

  expect(handler).toHaveBeenCalledWith({ flagsChanged: ['my-flag'] });
});

it('onClose flushes and closes the client', async () => {
  const client = new MockLDClient();
  const provider = new TestProvider(baseConfig(new TestLogger()), client);

  await provider.onClose();

  expect(client.flush).toHaveBeenCalled();
  expect(client.close).toHaveBeenCalled();
});

it('logs the construction error when setClientError is called', () => {
  const logger = new TestLogger();
  // eslint-disable-next-line no-new
  new TestProvider(baseConfig(logger), undefined, new Error('init fail'));
  expect(logger.logs.some((line) => line.includes('init fail'))).toEqual(true);
});

it('wraps a host logger that throws so flag evaluation does not crash', async () => {
  const throwingLogger = {
    error: () => {
      throw new Error('logger error path threw');
    },
    warn: () => {
      throw new Error('logger warn path threw');
    },
    info: () => {},
    debug: () => {},
  };
  const client = new MockLDClient();
  client.variationDetail.mockResolvedValue({
    value: true,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });
  const provider = new TestProvider(
    { logger: throwingLogger, providerName: 'p' },
    client,
  );

  await expect(
    provider.resolveBooleanEvaluation('flag', false, {
      targetingKey: 'u',
      kind: 42 as unknown as string,
    }),
  ).resolves.toEqual({ value: true, variant: '0', reason: 'OFF' });
});

