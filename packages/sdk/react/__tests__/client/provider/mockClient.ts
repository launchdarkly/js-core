import { LDContextStrict, LDWaitForInitializationResult } from '@launchdarkly/js-client-sdk';

import { InitializedState, LDReactClient } from '../../../src/client/LDClient';

export type MockClient = LDReactClient & {
  fireInitStatusChange: (status?: 'complete' | 'failed') => void;
  fireContextChange: (ctx: LDContextStrict) => void;
};

export interface MockClientOptions {
  flagOverrides?: Record<string, unknown>;
  /** Simulate a client that already failed initialization before mounting. */
  preFailedError?: Error;
}

export function makeMockClient(
  flagOverridesOrOptions: Record<string, unknown> | MockClientOptions = {},
): MockClient {
  const isOptions =
    'flagOverrides' in flagOverridesOrOptions || 'preFailedError' in flagOverridesOrOptions;
  const { flagOverrides = {}, preFailedError }: MockClientOptions = isOptions
    ? (flagOverridesOrOptions as MockClientOptions)
    : { flagOverrides: flagOverridesOrOptions as Record<string, unknown> };

  const initStatusSubscribers = new Set<(result: LDWaitForInitializationResult) => void>();
  const contextChangeSubscribers = new Set<(ctx: LDContextStrict) => void>();
  let initState: InitializedState = preFailedError ? 'failed' : 'unknown';
  let initError: Error | undefined = preFailedError;
  let currentContext: LDContextStrict | undefined;

  const client = {
    allFlags: jest.fn(() => ({ ...flagOverrides })),
    // @ts-ignore
    boolVariation: jest.fn((_key, def) => def),
    boolVariationDetail: jest.fn(),
    close: jest.fn(() => Promise.resolve()),
    flush: jest.fn(() => Promise.resolve({ result: true })),
    getContext: jest.fn(() => currentContext),
    getInitializationState: jest.fn((): InitializedState => initState),
    getInitializationError: jest.fn((): Error | undefined => initError),
    identify: jest.fn(() => Promise.resolve({ status: 'completed' as const })),
    jsonVariation: jest.fn((_key: string, def: unknown) => def),
    jsonVariationDetail: jest.fn(),
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    // @ts-ignore
    numberVariation: jest.fn((_key, def) => def),
    numberVariationDetail: jest.fn(),
    off: jest.fn(),
    on: jest.fn(),
    onContextChange: jest.fn((cb: (ctx: LDContextStrict) => void) => {
      contextChangeSubscribers.add(cb);
      return () => contextChangeSubscribers.delete(cb);
    }),
    onInitializationStatusChange: jest.fn((cb: (result: LDWaitForInitializationResult) => void) => {
      initStatusSubscribers.add(cb);
      return () => initStatusSubscribers.delete(cb);
    }),
    setStreaming: jest.fn(),
    start: jest.fn(),
    // @ts-ignore
    stringVariation: jest.fn((_key, def) => def),
    stringVariationDetail: jest.fn(),
    track: jest.fn(),
    variation: jest.fn((_key: string, def?: unknown) => def ?? null),
    variationDetail: jest.fn(),
    waitForInitialization: jest.fn(() => Promise.resolve({ status: 'complete' as const })),
    addHook: jest.fn(),
  } as unknown as LDReactClient;

  return {
    ...client,
    fireInitStatusChange: (status: 'complete' | 'failed' = 'complete') => {
      initState = status;
      const result: LDWaitForInitializationResult =
        status === 'complete' ? { status } : { status, error: new Error('init failed') };
      initError = result.status === 'failed' ? result.error : undefined;
      initStatusSubscribers.forEach((cb) => cb(result));
    },
    fireContextChange: (ctx: LDContextStrict) => {
      currentContext = ctx;
      contextChangeSubscribers.forEach((cb) => cb(ctx));
    },
  };
}
