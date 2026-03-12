import { LDContext, LDFlagsStateOptions } from '@launchdarkly/js-server-sdk-common';

import { createLDServerSession, isServer } from '../../src/server/index';

const context: LDContext = { kind: 'user', key: 'test-user' };

function makeMockBaseClient() {
  return {
    initialized: jest.fn(() => true),
    boolVariation: jest.fn((_key: string, _ctx: LDContext, def: boolean) => Promise.resolve(def)),
    numberVariation: jest.fn((_key: string, _ctx: LDContext, def: number) => Promise.resolve(def)),
    stringVariation: jest.fn((_key: string, _ctx: LDContext, def: string) => Promise.resolve(def)),
    jsonVariation: jest.fn((_key: string, _ctx: LDContext, def: unknown) => Promise.resolve(def)),
    boolVariationDetail: jest.fn((_key: string, _ctx: LDContext, def: boolean) =>
      Promise.resolve({ value: def, variationIndex: null, reason: { kind: 'OFF' as const } }),
    ),
    numberVariationDetail: jest.fn((_key: string, _ctx: LDContext, def: number) =>
      Promise.resolve({ value: def, variationIndex: null, reason: { kind: 'OFF' as const } }),
    ),
    stringVariationDetail: jest.fn((_key: string, _ctx: LDContext, def: string) =>
      Promise.resolve({ value: def, variationIndex: null, reason: { kind: 'OFF' as const } }),
    ),
    jsonVariationDetail: jest.fn((_key: string, _ctx: LDContext, def: unknown) =>
      Promise.resolve({ value: def, variationIndex: null, reason: { kind: 'OFF' as const } }),
    ),
    // @ts-ignore — mock return shape matches LDFlagsState structurally
    allFlagsState: jest.fn((_context: LDContext, _options?: LDFlagsStateOptions) =>
      Promise.resolve({
        valid: true,
        getFlagValue: jest.fn(),
        getFlagReason: jest.fn(),
        allValues: jest.fn(() => ({})),
        toJSON: jest.fn(() => ({ $flagsState: {}, $valid: true })),
      }),
    ),
  };
}

it('isServer() returns true in a Node test environment', () => {
  expect(isServer()).toBe(true);
});

it('getContext() returns the context passed at creation', () => {
  const client = makeMockBaseClient();
  const session = createLDServerSession(client, context);
  expect(session.getContext()).toEqual(context);
});

it('initialized() delegates to the base client', () => {
  const client = makeMockBaseClient();
  client.initialized.mockReturnValue(false);
  const session = createLDServerSession(client, context);
  expect(session.initialized()).toBe(false);
  expect(client.initialized).toHaveBeenCalledTimes(1);
});

it('boolVariation() calls base client with bound context', async () => {
  const client = makeMockBaseClient();
  client.boolVariation.mockResolvedValue(true);
  const session = createLDServerSession(client, context);
  const result = await session.boolVariation('my-flag', false);
  expect(result).toBe(true);
  expect(client.boolVariation).toHaveBeenCalledWith('my-flag', context, false);
});

it('numberVariation() calls base client with bound context', async () => {
  const client = makeMockBaseClient();
  client.numberVariation.mockResolvedValue(42);
  const session = createLDServerSession(client, context);
  const result = await session.numberVariation('my-flag', 0);
  expect(result).toBe(42);
  expect(client.numberVariation).toHaveBeenCalledWith('my-flag', context, 0);
});

it('stringVariation() calls base client with bound context', async () => {
  const client = makeMockBaseClient();
  client.stringVariation.mockResolvedValue('hello');
  const session = createLDServerSession(client, context);
  const result = await session.stringVariation('my-flag', 'default');
  expect(result).toBe('hello');
  expect(client.stringVariation).toHaveBeenCalledWith('my-flag', context, 'default');
});

it('jsonVariation() calls base client with bound context', async () => {
  const client = makeMockBaseClient();
  const json = { key: 'value' };
  client.jsonVariation.mockResolvedValue(json);
  const session = createLDServerSession(client, context);
  const result = await session.jsonVariation('my-flag', {});
  expect(result).toEqual(json);
  expect(client.jsonVariation).toHaveBeenCalledWith('my-flag', context, {});
});

it('boolVariationDetail() calls base client with bound context', async () => {
  const client = makeMockBaseClient();
  const detail = { value: true, variationIndex: 1, reason: { kind: 'RULE_MATCH' as const } };
  // @ts-ignore — valid LDEvaluationDetailTyped<boolean> shape; mock type is too narrow
  client.boolVariationDetail.mockResolvedValue(detail);
  const session = createLDServerSession(client, context);
  const result = await session.boolVariationDetail('my-flag', false);
  expect(result).toEqual(detail);
  expect(client.boolVariationDetail).toHaveBeenCalledWith('my-flag', context, false);
});

it('allFlagsState() calls base client with bound context', async () => {
  const client = makeMockBaseClient();
  const session = createLDServerSession(client, context);
  await session.allFlagsState();
  expect(client.allFlagsState).toHaveBeenCalledWith(context, undefined);
});

it('allFlagsState() forwards options to base client', async () => {
  const client = makeMockBaseClient();
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
    const client = makeMockBaseClient();
    expect(() => createLDServerSession(client, context)).toThrow(
      'createLDServerSession must only be called on the server.',
    );
  });
});
