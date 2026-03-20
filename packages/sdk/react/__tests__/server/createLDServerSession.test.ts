import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { createLDServerSession } from '../../src/server/index';
import { makeMockServerClient } from './mockServerClient';

const context: LDContext = { kind: 'user', key: 'test-user' };

it('getContext() returns the context passed at creation', () => {
  const client = makeMockServerClient();
  const session = createLDServerSession(client, context);
  expect(session.getContext()).toEqual(context);
});

it('initialized() delegates to the base client', () => {
  const client = makeMockServerClient();
  client.initialized.mockReturnValue(false);
  const session = createLDServerSession(client, context);
  expect(session.initialized()).toBe(false);
  expect(client.initialized).toHaveBeenCalledTimes(1);
});

it('boolVariation() calls base client with bound context', async () => {
  const client = makeMockServerClient();
  client.boolVariation.mockResolvedValue(true);
  const session = createLDServerSession(client, context);
  const result = await session.boolVariation('my-flag', false);
  expect(result).toBe(true);
  expect(client.boolVariation).toHaveBeenCalledWith('my-flag', context, false);
});

it('numberVariation() calls base client with bound context', async () => {
  const client = makeMockServerClient();
  client.numberVariation.mockResolvedValue(42);
  const session = createLDServerSession(client, context);
  const result = await session.numberVariation('my-flag', 0);
  expect(result).toBe(42);
  expect(client.numberVariation).toHaveBeenCalledWith('my-flag', context, 0);
});

it('stringVariation() calls base client with bound context', async () => {
  const client = makeMockServerClient();
  client.stringVariation.mockResolvedValue('hello');
  const session = createLDServerSession(client, context);
  const result = await session.stringVariation('my-flag', 'default');
  expect(result).toBe('hello');
  expect(client.stringVariation).toHaveBeenCalledWith('my-flag', context, 'default');
});

it('jsonVariation() calls base client with bound context', async () => {
  const client = makeMockServerClient();
  const json = { key: 'value' };
  client.jsonVariation.mockResolvedValue(json);
  const session = createLDServerSession(client, context);
  const result = await session.jsonVariation('my-flag', {});
  expect(result).toEqual(json);
  expect(client.jsonVariation).toHaveBeenCalledWith('my-flag', context, {});
});

it('boolVariationDetail() calls base client with bound context', async () => {
  const client = makeMockServerClient();
  const detail = { value: true, variationIndex: 1, reason: { kind: 'RULE_MATCH' as const } };
  // @ts-ignore — valid LDEvaluationDetailTyped<boolean> shape; mock type is too narrow
  client.boolVariationDetail.mockResolvedValue(detail);
  const session = createLDServerSession(client, context);
  const result = await session.boolVariationDetail('my-flag', false);
  expect(result).toEqual(detail);
  expect(client.boolVariationDetail).toHaveBeenCalledWith('my-flag', context, false);
});

it('numberVariationDetail() calls base client with bound context', async () => {
  const client = makeMockServerClient();
  const detail = { value: 42, variationIndex: 1, reason: { kind: 'RULE_MATCH' as const } };
  // @ts-ignore — valid LDEvaluationDetailTyped<number> shape; mock type is too narrow
  client.numberVariationDetail.mockResolvedValue(detail);
  const session = createLDServerSession(client, context);
  const result = await session.numberVariationDetail('my-flag', 0);
  expect(result).toEqual(detail);
  expect(client.numberVariationDetail).toHaveBeenCalledWith('my-flag', context, 0);
});

it('stringVariationDetail() calls base client with bound context', async () => {
  const client = makeMockServerClient();
  const detail = { value: 'hello', variationIndex: 1, reason: { kind: 'RULE_MATCH' as const } };
  // @ts-ignore — valid LDEvaluationDetailTyped<string> shape; mock type is too narrow
  client.stringVariationDetail.mockResolvedValue(detail);
  const session = createLDServerSession(client, context);
  const result = await session.stringVariationDetail('my-flag', 'default');
  expect(result).toEqual(detail);
  expect(client.stringVariationDetail).toHaveBeenCalledWith('my-flag', context, 'default');
});

it('jsonVariationDetail() calls base client with bound context', async () => {
  const client = makeMockServerClient();
  const detail = {
    value: { key: 'value' },
    variationIndex: 1,
    reason: { kind: 'RULE_MATCH' as const },
  };
  // @ts-ignore — valid LDEvaluationDetailTyped<unknown> shape; mock type is too narrow
  client.jsonVariationDetail.mockResolvedValue(detail);
  const session = createLDServerSession(client, context);
  const result = await session.jsonVariationDetail('my-flag', {});
  expect(result).toEqual(detail);
  expect(client.jsonVariationDetail).toHaveBeenCalledWith('my-flag', context, {});
});

it('allFlagsState() calls base client with bound context', async () => {
  const client = makeMockServerClient();
  const session = createLDServerSession(client, context);
  await session.allFlagsState();
  expect(client.allFlagsState).toHaveBeenCalledWith(context, undefined);
});

it('allFlagsState() forwards options to base client', async () => {
  const client = makeMockServerClient();
  const session = createLDServerSession(client, context);
  const options = { clientSideOnly: true };
  await session.allFlagsState(options);
  expect(client.allFlagsState).toHaveBeenCalledWith(context, options);
});

describe('given a browser environment (window defined)', () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
    // @ts-ignore
    globalThis.window = {};
  });

  afterEach(() => {
    // @ts-ignore
    globalThis.window = originalWindow;
  });

  it('throws an error instead of returning a no-op session', () => {
    const client = makeMockServerClient();
    expect(() => createLDServerSession(client, context)).toThrow(
      'createLDServerWrapper must only be called on the server.',
    );
  });
});
