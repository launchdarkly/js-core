/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';
import React from 'react';

import {
  InitializationStatus,
  useInitializationStatus,
} from '../../../src/client/hooks/useInitializationStatus';
import { InitializedState, LDReactClientContextValue } from '../../../src/client/LDClient';
import { LDReactContext } from '../../../src/client/provider/LDReactContext';
import { makeMockClient } from './mockClient';

function makeContextValue(state: InitializedState, error?: Error): LDReactClientContextValue {
  const mockClient = makeMockClient(state);
  return { client: mockClient, initializedState: state, error };
}

function StatusConsumer({ onStatus }: { onStatus: (s: InitializationStatus) => void }) {
  const status = useInitializationStatus();
  onStatus(status);
  return null;
}

it('returns { status: "unknown" } when initializedState is "unknown"', () => {
  const captured: InitializationStatus[] = [];

  render(
    <LDReactContext.Provider value={makeContextValue('unknown')}>
      <StatusConsumer onStatus={(s) => captured.push(s)} />
    </LDReactContext.Provider>,
  );

  expect(captured[0]).toEqual({ status: 'unknown' });
});

it('returns { status: "initializing" } when initializedState is "initializing"', () => {
  const captured: InitializationStatus[] = [];

  render(
    <LDReactContext.Provider value={makeContextValue('initializing')}>
      <StatusConsumer onStatus={(s) => captured.push(s)} />
    </LDReactContext.Provider>,
  );

  expect(captured[0]).toEqual({ status: 'initializing' });
});

it('returns { status: "complete" } when initializedState is "complete"', () => {
  const captured: InitializationStatus[] = [];

  render(
    <LDReactContext.Provider value={makeContextValue('complete')}>
      <StatusConsumer onStatus={(s) => captured.push(s)} />
    </LDReactContext.Provider>,
  );

  expect(captured[0]).toEqual({ status: 'complete' });
});

it('returns { status: "failed", error } when initializedState is "failed"', () => {
  const error = new Error('initialization failed');
  const captured: InitializationStatus[] = [];

  render(
    <LDReactContext.Provider value={makeContextValue('failed', error)}>
      <StatusConsumer onStatus={(s) => captured.push(s)} />
    </LDReactContext.Provider>,
  );

  expect(captured[0]).toEqual({ status: 'failed', error });
});

it('returns { status: "timeout" } when initializedState is "timeout"', () => {
  const captured: InitializationStatus[] = [];

  render(
    <LDReactContext.Provider value={makeContextValue('timeout')}>
      <StatusConsumer onStatus={(s) => captured.push(s)} />
    </LDReactContext.Provider>,
  );

  expect(captured[0]).toEqual({ status: 'timeout' });
});

it('reads status from a custom react context', () => {
  const customContext = React.createContext<LDReactClientContextValue>(null as any);
  const captured: InitializationStatus[] = [];

  function CustomConsumer() {
    const status = useInitializationStatus(customContext);
    captured.push(status);
    return null;
  }

  render(
    <customContext.Provider value={makeContextValue('complete')}>
      <CustomConsumer />
    </customContext.Provider>,
  );

  expect(captured[0]).toEqual({ status: 'complete' });
});
