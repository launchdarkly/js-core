import { LDContextStrict } from '@launchdarkly/js-client-sdk';

import { InitializedState, LDReactClient } from '../../../src/client/LDClient';

type EventHandler = (...args: any[]) => void;

export type MockClient = LDReactClient & {
  resolveStart: (status?: 'complete' | 'failed' | 'timeout', error?: Error) => void;
  fireContextChange: (ctx: LDContextStrict) => void;
  emitChange: (flags?: Record<string, unknown>) => void;
  emitFlagChange: (key: string) => void;
};

export function makeMockClient(initialState: InitializedState = 'unknown'): MockClient {
  let resolveStart: (
    result: { status: 'complete' } | { status: 'timeout' } | { status: 'failed'; error: Error },
  ) => void;
  const startPromise = new Promise<
    { status: 'complete' } | { status: 'timeout' } | { status: 'failed'; error: Error }
  >((resolve) => {
    resolveStart = resolve;
  });

  const contextChangeSubscribers = new Set<(ctx: LDContextStrict) => void>();
  let initState: InitializedState = initialState;
  let currentContext: LDContextStrict | undefined;
  const eventHandlers = new Map<string, Set<EventHandler>>();
  const flags: Record<string, unknown> = {};

  const client = {
    allFlags: jest.fn(() => ({ ...flags })),
    // @ts-ignore
    boolVariation: jest.fn((_key, def) => def),
    boolVariationDetail: jest.fn(),
    close: jest.fn(() => Promise.resolve()),
    flush: jest.fn(() => Promise.resolve({ result: true })),
    getContext: jest.fn(() => currentContext),
    getInitializationState: jest.fn((): InitializedState => initState),
    identify: jest.fn(() => Promise.resolve({ status: 'completed' as const })),
    jsonVariation: jest.fn((_key: string, def: unknown) => def),
    jsonVariationDetail: jest.fn(),
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    // @ts-ignore
    numberVariation: jest.fn((_key, def) => def),
    numberVariationDetail: jest.fn(),
    off: jest.fn((event: string, handler: EventHandler) => {
      eventHandlers.get(event)?.delete(handler);
    }),
    on: jest.fn((event: string, handler: EventHandler) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
    }),
    onContextChange: jest.fn((cb: (ctx: LDContextStrict) => void) => {
      contextChangeSubscribers.add(cb);
      return () => contextChangeSubscribers.delete(cb);
    }),
    setStreaming: jest.fn(),
    // @ts-ignore
    start: jest.fn(() => startPromise),
    // @ts-ignore
    stringVariation: jest.fn((_key, def) => def),
    stringVariationDetail: jest.fn(),
    track: jest.fn(),
    variation: jest.fn((key: string, def?: unknown) => flags[key] ?? def ?? null),
    variationDetail: jest.fn(),
    // @ts-ignore
    waitForInitialization: jest.fn(() => Promise.resolve({ status: 'complete' as const })),
    addHook: jest.fn(),
  } as unknown as LDReactClient;

  return {
    ...client,
    resolveStart: (status: 'complete' | 'failed' | 'timeout' = 'complete', error?: Error) => {
      initState = status;
      if (status === 'failed') {
        // @ts-ignore
        resolveStart({ status, error: error ?? new Error('initialization failed') });
      } else {
        // @ts-ignore
        resolveStart({ status });
      }
    },
    fireContextChange: (ctx: LDContextStrict) => {
      currentContext = ctx;
      contextChangeSubscribers.forEach((cb) => cb(ctx));
    },
    emitChange: (newFlags?: Record<string, unknown>) => {
      if (newFlags) {
        Object.assign(flags, newFlags);
      }
      const handlers = eventHandlers.get('change');
      handlers?.forEach((h) => h());
    },
    emitFlagChange: (key: string) => {
      const handlers = eventHandlers.get(`change:${key}`);
      handlers?.forEach((h) => h());
    },
  };
}
