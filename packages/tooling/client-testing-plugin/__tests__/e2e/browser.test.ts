/**
 * @jest-environment jsdom
 *
 * E2E integration test: creates a real browser SDK client with TestData
 * and verifies flag evaluation and dynamic updates work end-to-end.
 *
 * This demonstrates the exact usage pattern that library consumers would use
 * when writing unit tests for their applications.
 */
import { createClient } from '@launchdarkly/js-client-sdk';

import { TestData } from '../../src/index';

describe('Browser SDK integration', () => {
  let td: TestData;
  let client: ReturnType<typeof createClient>;

  beforeEach(async () => {
    td = new TestData({
      'bool-flag': true,
      'string-flag': 'hello',
      'number-flag': 42,
      'json-flag': { key: 'value' },
      'multi-variation': 'green',
    });

    client = createClient(
      'test-client-id',
      { kind: 'user', key: 'test-user' },
      {
        plugins: [td],
        sendEvents: false,
        diagnosticOptOut: true,
        streaming: false,
      },
    );

    await client.start({ bootstrap: {} });
  });

  afterEach(async () => {
    await client.close();
  });

  it('evaluates boolean flags', () => {
    expect(client.boolVariation('bool-flag', false)).toBe(true);
  });

  it('evaluates boolean flags via boolVariationDetail', () => {
    const detail = client.boolVariationDetail('bool-flag', false);
    expect(detail.value).toBe(true);
    // Override descriptors carry no variation index and no reason -- assert the
    // shape the SDK actually produces so future regressions are caught.
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toBeUndefined();
  });

  it('evaluates string flags', () => {
    expect(client.stringVariation('string-flag', 'default')).toBe('hello');
  });

  it('evaluates string flags via stringVariationDetail', () => {
    const detail = client.stringVariationDetail('string-flag', 'default');
    expect(detail.value).toBe('hello');
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toBeUndefined();
  });

  it('evaluates number flags', () => {
    expect(client.numberVariation('number-flag', 0)).toBe(42);
  });

  it('evaluates number flags via numberVariationDetail', () => {
    const detail = client.numberVariationDetail('number-flag', 0);
    expect(detail.value).toBe(42);
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toBeUndefined();
  });

  it('evaluates json flags', () => {
    expect(client.jsonVariation('json-flag', null)).toEqual({ key: 'value' });
  });

  it('evaluates json flags via jsonVariationDetail', () => {
    const detail = client.jsonVariationDetail('json-flag', null);
    expect(detail.value).toEqual({ key: 'value' });
    expect(detail.variationIndex).toBeNull();
    expect(detail.reason).toBeUndefined();
  });

  it('evaluates string flags overridden to one of several possible values', () => {
    expect(client.stringVariation('multi-variation', 'default')).toBe('green');
  });

  it('returns all flags via allFlags()', () => {
    const flags = client.allFlags();
    expect(flags['bool-flag']).toBe(true);
    expect(flags['string-flag']).toBe('hello');
    expect(flags['number-flag']).toBe(42);
    expect(flags['multi-variation']).toBe('green');
  });

  it('returns default when flag is not defined', () => {
    expect(client.boolVariation('nonexistent', false)).toBe(false);
    expect(client.stringVariation('nonexistent', 'fallback')).toBe('fallback');
  });

  it('dynamically updates a flag and fires change event', async () => {
    expect(client.boolVariation('bool-flag', false)).toBe(true);

    const changed = new Promise<void>((resolve) => {
      client.on('change:bool-flag', () => resolve());
    });

    td.setBool('bool-flag', false);

    await changed;

    expect(client.boolVariation('bool-flag', true)).toBe(false);
  });

  it('adds a new flag dynamically after initialization', async () => {
    expect(client.stringVariation('new-flag', 'default')).toBe('default');

    const changed = new Promise<void>((resolve) => {
      client.on('change:new-flag', () => resolve());
    });

    td.setString('new-flag', 'surprise');

    await changed;

    expect(client.stringVariation('new-flag', 'default')).toBe('surprise');
  });

  it('updates a string flag to a different value', async () => {
    expect(client.stringVariation('multi-variation', 'default')).toBe('green');

    const changed = new Promise<void>((resolve) => {
      client.on('change:multi-variation', () => resolve());
    });

    td.setString('multi-variation', 'blue');

    await changed;

    expect(client.stringVariation('multi-variation', 'default')).toBe('blue');
  });
});
