import { LDSingleKindContext } from '@launchdarkly/js-sdk-common';

import { LDClientImpl } from '../src';
import { LDClient, LDMigrationStage, LDScopedClient } from '../src/api';
import createScopedClient from '../src/createScopedClient';
import TestData from '../src/integrations/test_data/TestData';
import { createBasicPlatform } from './createBasicPlatform';
import TestLogger, { LogLevel } from './Logger';
import makeCallbacks from './makeCallbacks';

function createMockClient(overrides?: Partial<LDClient>): LDClient {
  return {
    initialized: jest.fn(() => true),
    waitForInitialization: jest.fn(),
    variation: jest.fn(async () => 'value'),
    variationDetail: jest.fn(async () => ({
      value: 'value',
      variationIndex: 0,
      reason: { kind: 'OFF' },
    })),
    boolVariation: jest.fn(async () => true),
    numberVariation: jest.fn(async () => 42),
    stringVariation: jest.fn(async () => 'hello'),
    jsonVariation: jest.fn(async () => ({ key: 'value' })),
    boolVariationDetail: jest.fn(async () => ({
      value: true,
      variationIndex: 0,
      reason: { kind: 'OFF' },
    })),
    numberVariationDetail: jest.fn(async () => ({
      value: 42,
      variationIndex: 0,
      reason: { kind: 'OFF' },
    })),
    stringVariationDetail: jest.fn(async () => ({
      value: 'hello',
      variationIndex: 0,
      reason: { kind: 'OFF' },
    })),
    jsonVariationDetail: jest.fn(async () => ({
      value: { key: 'value' },
      variationIndex: 0,
      reason: { kind: 'OFF' },
    })),
    migrationVariation: jest.fn(async () => ({
      value: 'off' as LDMigrationStage,
      tracker: {} as any,
    })),
    allFlagsState: jest.fn(async () => ({
      valid: true,
      toJSON: () => ({}),
      allValues: () => ({}),
      getFlagValue: () => null,
      getFlagReason: () => null,
    })) as any,
    track: jest.fn(),
    trackMigration: jest.fn(),
    identify: jest.fn(),
    flush: jest.fn(async () => {}),
    close: jest.fn(),
    isOffline: jest.fn(() => false),
    secureModeHash: jest.fn(() => 'hash'),
    forContext: jest.fn(),
    addHook: jest.fn(),
    get logger() {
      return (
        overrides?.logger ??
        ({
          error: jest.fn(),
          warn: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
        } as any)
      );
    },
    ...overrides,
  } as LDClient;
}

describe('LDScopedClient via LDClientImpl', () => {
  let client: LDClientImpl;
  let td: TestData;

  beforeEach(async () => {
    td = new TestData();
    client = new LDClientImpl(
      'sdk-key-scoped-client-test',
      createBasicPlatform(),
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
      },
      makeCallbacks(true),
    );
    await client.waitForInitialization({ timeout: 10 });
  });

  afterEach(() => {
    client.close();
  });

  describe('context initialization', () => {
    it('initializes from a single-kind context', () => {
      const scoped = client.forContext({ kind: 'user', key: 'user-1', name: 'Alice' });
      const ctx = scoped.currentContext() as LDSingleKindContext;

      expect(ctx.kind).toBe('user');
      expect(ctx.key).toBe('user-1');
      expect(ctx.name).toBe('Alice');
    });

    it('initializes from a multi-kind context', () => {
      const scoped = client.forContext({
        kind: 'multi',
        user: { key: 'user-1', name: 'Alice' },
        org: { key: 'org-1', name: 'Acme' },
      });
      const ctx = scoped.currentContext();

      expect(ctx).toEqual({
        kind: 'multi',
        user: { key: 'user-1', name: 'Alice' },
        org: { key: 'org-1', name: 'Acme' },
      });
    });

    it('logs a warning when created with an invalid context', () => {
      const logger = new TestLogger();
      const logClient = new LDClientImpl(
        'sdk-key-scoped-invalid-ctx-test',
        createBasicPlatform(),
        {
          updateProcessor: td.getFactory(),
          sendEvents: false,
          logger,
        },
        makeCallbacks(true),
      );

      // @ts-ignore — intentionally passing invalid context
      logClient.forContext(null);

      logger.expectMessages([{ level: LogLevel.Warn, matches: /invalid context/ }]);

      logClient.close();
    });
  });

  describe('addContext', () => {
    it('adds a new context kind', () => {
      const scoped = client.forContext({ kind: 'user', key: 'user-1' });
      scoped.addContext({ kind: 'org', key: 'org-1', name: 'Acme' });

      const ctx = scoped.currentContext();
      expect(ctx).toEqual({
        kind: 'multi',
        user: { key: 'user-1' },
        org: { key: 'org-1', name: 'Acme' },
      });
    });

    it('rejects a duplicate context kind with a warning', () => {
      const logger = new TestLogger();
      const logClient = new LDClientImpl(
        'sdk-key-scoped-logger-test',
        createBasicPlatform(),
        {
          updateProcessor: td.getFactory(),
          sendEvents: false,
          logger,
        },
        makeCallbacks(true),
      );

      const scoped = logClient.forContext({ kind: 'user', key: 'user-1', name: 'Alice' });
      scoped.addContext({ kind: 'user', key: 'user-2', name: 'Bob' });

      // Original context should be preserved
      const ctx = scoped.currentContext() as LDSingleKindContext;
      expect(ctx.key).toBe('user-1');
      expect(ctx.name).toBe('Alice');

      // Warning should have been logged
      expect(logger.getCount(LogLevel.Warn)).toBe(1);
      logger.expectMessages([
        { level: LogLevel.Warn, matches: /Tried to add a duplicate user context to scoped client/ },
      ]);

      logClient.close();
    });
  });

  describe('overwriteContextByKind', () => {
    it('replaces an existing context kind', () => {
      const scoped = client.forContext({ kind: 'user', key: 'user-1', name: 'Alice' });
      scoped.overwriteContextByKind({ kind: 'user', key: 'user-2', name: 'Bob' });

      const ctx = scoped.currentContext() as LDSingleKindContext;
      expect(ctx.kind).toBe('user');
      expect(ctx.key).toBe('user-2');
      expect(ctx.name).toBe('Bob');
    });

    it('adds a new kind if it does not exist', () => {
      const scoped = client.forContext({ kind: 'user', key: 'user-1' });
      scoped.overwriteContextByKind({ kind: 'org', key: 'org-1' });

      const ctx = scoped.currentContext();
      expect(ctx).toEqual({
        kind: 'multi',
        user: { key: 'user-1' },
        org: { key: 'org-1' },
      });
    });
  });

  describe('chaining', () => {
    it('supports chaining addContext calls', () => {
      const scoped = client
        .forContext({ kind: 'user', key: 'user-1' })
        .addContext({ kind: 'org', key: 'org-1' })
        .addContext({ kind: 'device', key: 'device-1' });

      const ctx = scoped.currentContext();
      expect((ctx as any).kind).toBe('multi');
      expect((ctx as any).user).toEqual({ key: 'user-1' });
      expect((ctx as any).org).toEqual({ key: 'org-1' });
      expect((ctx as any).device).toEqual({ key: 'device-1' });
    });

    it('supports chaining overwriteContextByKind', () => {
      const scoped = client
        .forContext({ kind: 'user', key: 'user-1' })
        .overwriteContextByKind({ kind: 'user', key: 'user-2' });

      const ctx = scoped.currentContext() as LDSingleKindContext;
      expect(ctx.key).toBe('user-2');
    });

    it('supports mixed chaining', () => {
      const scoped = client
        .forContext({ kind: 'user', key: 'user-1' })
        .addContext({ kind: 'org', key: 'org-1' })
        .overwriteContextByKind({ kind: 'user', key: 'user-2' });

      const ctx = scoped.currentContext();
      expect((ctx as any).user).toEqual({ key: 'user-2' });
      expect((ctx as any).org).toEqual({ key: 'org-1' });
    });
  });

  describe('currentContext', () => {
    it('returns a single-kind context when only one kind exists', () => {
      const scoped = client.forContext({ kind: 'user', key: 'user-1' });
      const ctx = scoped.currentContext() as LDSingleKindContext;

      expect(ctx.kind).toBe('user');
      expect(ctx.key).toBe('user-1');
    });

    it('returns a multi-kind context when multiple kinds exist', () => {
      const scoped = client.forContext({ kind: 'user', key: 'user-1' });
      scoped.addContext({ kind: 'org', key: 'org-1' });
      scoped.addContext({ kind: 'device', key: 'device-1' });

      const ctx = scoped.currentContext();
      expect((ctx as any).kind).toBe('multi');
      expect((ctx as any).user).toEqual({ key: 'user-1' });
      expect((ctx as any).org).toEqual({ key: 'org-1' });
      expect((ctx as any).device).toEqual({ key: 'device-1' });
    });

    it('reflects the context at time of call', () => {
      const scoped = client.forContext({ kind: 'user', key: 'user-1' });
      const ctx1 = scoped.currentContext();

      scoped.addContext({ kind: 'org', key: 'org-1' });
      const ctx2 = scoped.currentContext();

      expect((ctx1 as LDSingleKindContext).kind).toBe('user');
      expect((ctx2 as any).kind).toBe('multi');
    });
  });

  describe('variation delegation', () => {
    it('evaluates a flag using the accumulated context', async () => {
      await td.update(td.flag('test-flag').booleanFlag().variationForAll(true));

      const scoped = client.forContext({ kind: 'user', key: 'user-1' });
      const result = await scoped.boolVariation('test-flag', false);

      expect(result).toBe(true);
    });

    it('evaluates with context added after creation', async () => {
      await td.update(td.flag('test-flag').booleanFlag().variationForAll(true));

      const scoped = client.forContext({ kind: 'user', key: 'user-1' });
      scoped.addContext({ kind: 'org', key: 'org-1' });

      const result = await scoped.boolVariation('test-flag', false);
      expect(result).toBe(true);
    });
  });

  describe('client accessor', () => {
    it('returns the base client', () => {
      const scoped = client.forContext({ kind: 'user', key: 'user-1' });
      expect(scoped.client).toBe(client);
    });
  });

  describe('independence', () => {
    it('scoped clients from the same base are independent', () => {
      const scoped1 = client.forContext({ kind: 'user', key: 'user-1' });
      const scoped2 = client.forContext({ kind: 'user', key: 'user-2' });

      scoped1.addContext({ kind: 'org', key: 'org-1' });

      // scoped2 should NOT have the org context
      const ctx2 = scoped2.currentContext() as LDSingleKindContext;
      expect(ctx2.kind).toBe('user');
      expect(ctx2.key).toBe('user-2');
      expect((ctx2 as any).org).toBeUndefined();
    });
  });
});

// Test delegation via mock client for precise argument verification
describe('LDScopedClient delegation', () => {
  let mockClient: LDClient;
  let scoped: LDScopedClient;
  const userContext: LDSingleKindContext = { kind: 'user', key: 'user-1' };

  beforeEach(() => {
    mockClient = createMockClient();
    scoped = createScopedClient(mockClient, userContext);
  });

  describe('variation methods', () => {
    it('delegates variation with currentContext', async () => {
      await scoped.variation('flag', 'default');
      expect(mockClient.variation).toHaveBeenCalledWith(
        'flag',
        { kind: 'user', key: 'user-1' },
        'default',
      );
    });

    it('delegates variationDetail with currentContext', async () => {
      await scoped.variationDetail('flag', 'default');
      expect(mockClient.variationDetail).toHaveBeenCalledWith(
        'flag',
        { kind: 'user', key: 'user-1' },
        'default',
      );
    });

    it('delegates boolVariation with currentContext', async () => {
      await scoped.boolVariation('flag', false);
      expect(mockClient.boolVariation).toHaveBeenCalledWith(
        'flag',
        { kind: 'user', key: 'user-1' },
        false,
      );
    });

    it('delegates numberVariation with currentContext', async () => {
      await scoped.numberVariation('flag', 0);
      expect(mockClient.numberVariation).toHaveBeenCalledWith(
        'flag',
        { kind: 'user', key: 'user-1' },
        0,
      );
    });

    it('delegates stringVariation with currentContext', async () => {
      await scoped.stringVariation('flag', '');
      expect(mockClient.stringVariation).toHaveBeenCalledWith(
        'flag',
        { kind: 'user', key: 'user-1' },
        '',
      );
    });

    it('delegates jsonVariation with currentContext', async () => {
      await scoped.jsonVariation('flag', null);
      expect(mockClient.jsonVariation).toHaveBeenCalledWith(
        'flag',
        { kind: 'user', key: 'user-1' },
        null,
      );
    });

    it('delegates boolVariationDetail with currentContext', async () => {
      await scoped.boolVariationDetail('flag', false);
      expect(mockClient.boolVariationDetail).toHaveBeenCalledWith(
        'flag',
        { kind: 'user', key: 'user-1' },
        false,
      );
    });

    it('delegates numberVariationDetail with currentContext', async () => {
      await scoped.numberVariationDetail('flag', 0);
      expect(mockClient.numberVariationDetail).toHaveBeenCalledWith(
        'flag',
        { kind: 'user', key: 'user-1' },
        0,
      );
    });

    it('delegates stringVariationDetail with currentContext', async () => {
      await scoped.stringVariationDetail('flag', '');
      expect(mockClient.stringVariationDetail).toHaveBeenCalledWith(
        'flag',
        { kind: 'user', key: 'user-1' },
        '',
      );
    });

    it('delegates jsonVariationDetail with currentContext', async () => {
      await scoped.jsonVariationDetail('flag', null);
      expect(mockClient.jsonVariationDetail).toHaveBeenCalledWith(
        'flag',
        { kind: 'user', key: 'user-1' },
        null,
      );
    });

    it('delegates migrationVariation with currentContext', async () => {
      await scoped.migrationVariation('flag', LDMigrationStage.Off);
      expect(mockClient.migrationVariation).toHaveBeenCalledWith(
        'flag',
        { kind: 'user', key: 'user-1' },
        LDMigrationStage.Off,
      );
    });
  });

  describe('flags state', () => {
    it('delegates allFlagsState with currentContext', async () => {
      await scoped.allFlagsState({ clientSideOnly: true });
      expect(mockClient.allFlagsState).toHaveBeenCalledWith(
        { kind: 'user', key: 'user-1' },
        { clientSideOnly: true },
      );
    });
  });

  describe('track methods', () => {
    it('delegates track with currentContext', () => {
      scoped.track('event-key');
      expect(mockClient.track).toHaveBeenCalledWith('event-key', { kind: 'user', key: 'user-1' });
    });

    it('delegates trackData with currentContext and data', () => {
      scoped.trackData('event-key', { info: 'data' });
      expect(mockClient.track).toHaveBeenCalledWith(
        'event-key',
        { kind: 'user', key: 'user-1' },
        { info: 'data' },
      );
    });

    it('delegates trackMetric with currentContext, metric value, and optional data', () => {
      scoped.trackMetric('event-key', 42, { info: 'data' });
      expect(mockClient.track).toHaveBeenCalledWith(
        'event-key',
        { kind: 'user', key: 'user-1' },
        { info: 'data' },
        42,
      );
    });

    it('delegates trackMetric without data', () => {
      scoped.trackMetric('event-key', 42);
      expect(mockClient.track).toHaveBeenCalledWith(
        'event-key',
        { kind: 'user', key: 'user-1' },
        undefined,
        42,
      );
    });

    it('delegates trackMigration', () => {
      const event = { kind: 'migration_op' } as any;
      scoped.trackMigration(event);
      expect(mockClient.trackMigration).toHaveBeenCalledWith(event);
    });

    it('uses the context at time of track call', () => {
      const sc = createScopedClient(mockClient, { kind: 'user', key: 'user-1' });

      sc.addContext({ kind: 'org', key: 'org-1' });
      sc.track('event-key');

      expect(mockClient.track).toHaveBeenCalledWith('event-key', {
        kind: 'multi',
        user: { key: 'user-1' },
        org: { key: 'org-1' },
      });
    });
  });

  describe('does not expose lifecycle methods', () => {
    it('does not have close method', () => {
      expect((scoped as any).close).toBeUndefined();
    });

    it('does not have flush method', () => {
      expect((scoped as any).flush).toBeUndefined();
    });

    it('does not have initialized method', () => {
      expect((scoped as any).initialized).toBeUndefined();
    });
  });
});

describe('wrapper diagnostic reporting', () => {
  let client: LDClientImpl;
  let sendScopedClientDiagnosticEvent: jest.SpyInstance;
  let td: TestData;

  beforeEach(async () => {
    td = new TestData();
    client = new LDClientImpl(
      'sdk-key-wrapper-test',
      createBasicPlatform(),
      {
        updateProcessor: td.getFactory(),
        sendEvents: true,
      },
      makeCallbacks(true),
    );
    await client.waitForInitialization({ timeout: 10 });

    // eslint-disable-next-line no-underscore-dangle
    const ep = (client as any)._eventProcessor;
    sendScopedClientDiagnosticEvent = jest.spyOn(ep, 'sendScopedClientDiagnosticEvent');
  });

  afterEach(() => {
    client.close();
  });

  it('sends a diagnostic-init event immediately on forContext', () => {
    client.forContext(
      { kind: 'user', key: 'user-1' },
      { wrapperName: 'test-wrapper', wrapperVersion: '1.0.0' },
    );

    expect(sendScopedClientDiagnosticEvent).toHaveBeenCalledTimes(1);
    expect(sendScopedClientDiagnosticEvent).toHaveBeenCalledWith('test-wrapper', '1.0.0');
  });

  it('deduplicates by (wrapperName, wrapperVersion) tuple', () => {
    client.forContext({ kind: 'user', key: 'user-1' }, { wrapperName: 'w', wrapperVersion: '1.0' });
    client.forContext({ kind: 'user', key: 'user-2' }, { wrapperName: 'w', wrapperVersion: '1.0' });
    client.forContext({ kind: 'user', key: 'user-3' }, { wrapperName: 'w', wrapperVersion: '1.0' });

    expect(sendScopedClientDiagnosticEvent).toHaveBeenCalledTimes(1);
  });

  it('treats different versions as distinct identities', () => {
    client.forContext({ kind: 'user', key: 'user-1' }, { wrapperName: 'w', wrapperVersion: '1.0' });
    client.forContext({ kind: 'user', key: 'user-2' }, { wrapperName: 'w', wrapperVersion: '2.0' });

    expect(sendScopedClientDiagnosticEvent).toHaveBeenCalledTimes(2);
    expect(sendScopedClientDiagnosticEvent).toHaveBeenNthCalledWith(1, 'w', '1.0');
    expect(sendScopedClientDiagnosticEvent).toHaveBeenNthCalledWith(2, 'w', '2.0');
  });

  it('treats name with version vs name without version as distinct', () => {
    client.forContext({ kind: 'user', key: 'user-1' }, { wrapperName: 'w', wrapperVersion: '1.0' });
    client.forContext({ kind: 'user', key: 'user-2' }, { wrapperName: 'w' });

    expect(sendScopedClientDiagnosticEvent).toHaveBeenCalledTimes(2);
  });

  it('does not send a diagnostic event without wrapperName', () => {
    client.forContext({ kind: 'user', key: 'user-1' });
    client.forContext({ kind: 'user', key: 'user-2' }, {});
    client.forContext({ kind: 'user', key: 'user-3' }, { wrapperVersion: '1.0.0' });

    expect(sendScopedClientDiagnosticEvent).not.toHaveBeenCalled();
  });

  it('does not send when events are disabled', async () => {
    const noEventsClient = new LDClientImpl(
      'sdk-key-no-events',
      createBasicPlatform(),
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
      },
      makeCallbacks(true),
    );
    await noEventsClient.waitForInitialization({ timeout: 10 });

    noEventsClient.forContext({ kind: 'user', key: 'user-1' }, { wrapperName: 'test-wrapper' });

    // No crash, no event sent (NullEventProcessor, instanceof check fails)
    noEventsClient.close();
  });
});
