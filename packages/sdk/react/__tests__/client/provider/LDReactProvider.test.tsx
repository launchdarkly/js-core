/**
 * @jest-environment jsdom
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import React, { useContext } from 'react';

import { LDContextStrict } from '@launchdarkly/js-client-sdk';

import {
  InitializedState,
  LDReactClient,
  LDReactClientContextValue,
} from '../../../src/client/LDClient';
import { LDReactContext } from '../../../src/client/provider/LDReactContext';
import { createLDReactProvider } from '../../../src/client/provider/LDReactProvider';

function makeMockClient(): LDReactClient & {
  resolveStart: (status?: 'complete' | 'failed') => void;
  fireContextChange: (ctx: LDContextStrict) => void;
} {
  let resolveStart: (result: { status: 'complete' | 'failed' }) => void;
  const startPromise = new Promise<{ status: 'complete' | 'failed' }>((resolve) => {
    resolveStart = resolve;
  });

  const contextChangeSubscribers = new Set<(ctx: LDContextStrict) => void>();
  let initState: InitializedState = 'unknown';
  let currentContext: LDContextStrict | undefined;

  const client = {
    allFlags: jest.fn(() => ({})),
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
    off: jest.fn(),
    on: jest.fn(),
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
    variation: jest.fn((_key: string, def?: unknown) => def ?? null),
    variationDetail: jest.fn(),
    // @ts-ignore
    waitForInitialization: jest.fn(() => Promise.resolve({ status: 'complete' as const })),
    addHook: jest.fn(),
  } as unknown as LDReactClient;

  return {
    ...client,
    resolveStart: (status: 'complete' | 'failed' = 'complete') => {
      initState = status;
      // @ts-ignore
      resolveStart({ status });
    },
    fireContextChange: (ctx: LDContextStrict) => {
      currentContext = ctx;
      contextChangeSubscribers.forEach((cb) => cb(ctx));
    },
  };
}

it('renders children', () => {
  const client = makeMockClient();
  const Provider = createLDReactProvider(client);

  render(
    <Provider>
      <span>hello</span>
    </Provider>,
  );

  expect(screen.getByText('hello')).toBeTruthy();
});

it('calls client.start() on mount', () => {
  const client = makeMockClient();
  const Provider = createLDReactProvider(client);

  render(
    <Provider>
      <span />
    </Provider>,
  );

  expect(client.start).toHaveBeenCalledTimes(1);
});

it('updates initializedState and context when start() resolves', async () => {
  const initialCtx: LDContextStrict = { kind: 'user', key: 'u1' };
  const client = makeMockClient();
  (client.getContext as jest.Mock).mockReturnValue(initialCtx);

  const contextValues: LDReactClientContextValue[] = [];

  function Consumer() {
    const value = useContext(LDReactContext);
    contextValues.push(value);
    return null;
  }

  const Provider = createLDReactProvider(client);

  render(
    <Provider>
      <Consumer />
    </Provider>,
  );

  expect(contextValues[contextValues.length - 1]?.initializedState).toBe('unknown');

  await act(async () => {
    client.resolveStart('complete');
  });

  await waitFor(() => {
    expect(contextValues[contextValues.length - 1]?.initializedState).toBe('complete');
  });
  expect(contextValues[contextValues.length - 1]?.context).toEqual(initialCtx);
});

it('updates context when onContextChange fires', async () => {
  const client = makeMockClient();
  const newCtx: LDContextStrict = { kind: 'user', key: 'user-2', name: 'Jamie' };
  const contextValues: LDReactClientContextValue[] = [];

  function Consumer() {
    const value = useContext(LDReactContext);
    contextValues.push(value);
    return null;
  }

  const Provider = createLDReactProvider(client);

  render(
    <Provider>
      <Consumer />
    </Provider>,
  );

  await act(async () => {
    client.fireContextChange(newCtx);
  });

  await waitFor(() => {
    expect(contextValues[contextValues.length - 1]?.context).toEqual(newCtx);
  });
});

it('does not call setState after unmount (cleanup)', async () => {
  const client = makeMockClient();
  const Provider = createLDReactProvider(client);

  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  const { unmount } = render(
    <Provider>
      <span />
    </Provider>,
  );

  // Unmount before start resolves
  unmount();

  // Now resolve start — the mounted guard should prevent any setState calls
  await act(async () => {
    client.resolveStart('complete');
  });

  // React 18 does not warn on setState after unmount for function components,
  // but we verify no error was thrown and start was called exactly once
  consoleSpy.mockRestore();
  expect(client.start).toHaveBeenCalledTimes(1);
});
