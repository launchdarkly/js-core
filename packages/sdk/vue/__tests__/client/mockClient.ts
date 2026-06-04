import type { LDEvaluationDetailTyped } from '@launchdarkly/js-client-sdk';

import type { LDVueClient } from '../../src/client/LDClient';

export interface MockControls {
  setBool: (v: boolean) => void;
  emitChange: (key: string) => void;
  handlerCount: (event: string) => number;
  emitInitStatus: (r: { status: string; error?: Error }) => void;
  emitContextChange: (c: unknown) => void;
  subscriberCount: () => number;
  contextSubscriberCount: () => number;
}

/**
 * A controllable in-memory LDVueClient stand-in for component tests. Returns the client plus a
 * `controls` object used to drive events from tests.
 */
export function makeMockClient(initial?: {
  ready?: boolean;
  initializedState?: string;
  boolValue?: boolean;
}): { client: LDVueClient; controls: MockControls } {
  let ready = initial?.ready ?? true;
  let initializedState = initial?.initializedState ?? 'complete';
  let boolValue = initial?.boolValue ?? true;
  let initError: Error | undefined;

  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const initStatusSubs = new Set<(r: { status: string; error?: Error }) => void>();
  const contextSubs = new Set<(c: unknown) => void>();

  const addHandler = (event: string, h: (...args: unknown[]) => void) => {
    if (!handlers.has(event)) {
      handlers.set(event, []);
    }
    handlers.get(event)!.push(h);
  };

  const notReadyDetail = <T>(def: T): LDEvaluationDetailTyped<T> => ({
    value: def,
    variationIndex: null,
    reason: { kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' },
  });

  const client = {
    getContext: () => ({ kind: 'user', key: 'context-key' }),
    getInitializationState: () => initializedState,
    getInitializationError: () => initError,
    onInitializationStatusChange: (cb: (r: { status: string; error?: Error }) => void) => {
      initStatusSubs.add(cb);
      return () => initStatusSubs.delete(cb);
    },
    onContextChange: (cb: (c: unknown) => void) => {
      contextSubs.add(cb);
      return () => contextSubs.delete(cb);
    },
    isReady: jest.fn(() => ready),
    boolVariation: jest.fn(() => boolValue),
    stringVariation: jest.fn((_key: string, def: string) => def),
    numberVariation: jest.fn((_key: string, def: number) => def),
    jsonVariation: jest.fn((_key: string, def: unknown) => def),
    boolVariationDetail: jest.fn((_key: string, def: boolean) => notReadyDetail(def)),
    stringVariationDetail: jest.fn((_key: string, def: string) => notReadyDetail(def)),
    numberVariationDetail: jest.fn((_key: string, def: number) => notReadyDetail(def)),
    jsonVariationDetail: jest.fn((_key: string, def: unknown) => notReadyDetail(def)),
    allFlags: jest.fn(() => ({})),
    variation: jest.fn(),
    identify: jest.fn(),
    track: jest.fn(),
    flush: jest.fn(),
    start: jest.fn(),
    close: jest.fn(),
    on: jest.fn((event: string, h: (...args: unknown[]) => void) => addHandler(event, h)),
    off: jest.fn((event: string, h: (...args: unknown[]) => void) => {
      const arr = handlers.get(event);
      if (arr) {
        const idx = arr.indexOf(h);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }),
  };

  const controls: MockControls = {
    setBool: (v: boolean) => {
      boolValue = v;
    },
    // mirrors the real client: change:<key> events carry the context, not the new flag value
    emitChange: (key: string) =>
      handlers.get(`change:${key}`)?.forEach((h) => h({ kind: 'user', key: 'context-key' })),
    handlerCount: (event: string) => handlers.get(event)?.length ?? 0,
    emitInitStatus: (r: { status: string; error?: Error }) => {
      ready = r.status !== 'initializing';
      initializedState = r.status;
      initError = r.error;
      initStatusSubs.forEach((cb) => cb(r));
    },
    emitContextChange: (c: unknown) => contextSubs.forEach((cb) => cb(c)),
    subscriberCount: () => initStatusSubs.size + contextSubs.size,
    // separate from subscriberCount so composable tests can assert on context subs alone,
    // without init-status subs (which the composable doesn't use) muddying the count
    contextSubscriberCount: () => contextSubs.size,
  };

  return { client: client as unknown as LDVueClient, controls };
}
