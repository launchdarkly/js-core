/**
 * @jest-environment jsdom
 */
import { act, render } from '@testing-library/react';
import React from 'react';

import { useFlags } from '../../../src/client/hooks/useFlags';
import { LDReactClientContextValue } from '../../../src/client/LDClient';
import { LDReactContext } from '../../../src/client/provider/LDReactContext';
import { makeMockClient } from './mockClient';

function FlagsConsumer({ onFlags }: { onFlags: (flags: Record<string, unknown>) => void }) {
  const flags = useFlags();
  onFlags(flags);
  return <span data-testid="output">{JSON.stringify(flags)}</span>;
}

function makeWrapper(mockClient: ReturnType<typeof makeMockClient>) {
  const contextValue: LDReactClientContextValue = {
    client: mockClient,
    initializedState: 'unknown',
  };

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <LDReactContext.Provider value={contextValue}>{children}</LDReactContext.Provider>;
  };
}

it('returns initial flag values from client.allFlags()', () => {
  const mockClient = makeMockClient();
  (mockClient.allFlags as jest.Mock).mockReturnValue({ 'my-flag': true });

  const captured: Record<string, unknown>[] = [];

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagsConsumer onFlags={(f) => captured.push(f)} />
    </Wrapper>,
  );

  expect(captured[0]).toEqual({ 'my-flag': true });
});

it('subscribes to change event on mount and unsubscribes on unmount', () => {
  const mockClient = makeMockClient();

  const Wrapper = makeWrapper(mockClient);
  const { unmount } = render(
    <Wrapper>
      <FlagsConsumer onFlags={() => {}} />
    </Wrapper>,
  );

  expect(mockClient.on).toHaveBeenCalledWith('change', expect.any(Function));

  const onCall = (mockClient.on as jest.Mock).mock.calls.find(
    ([event]: [string]) => event === 'change',
  );
  const handler = onCall?.[1];

  unmount();

  expect(mockClient.off).toHaveBeenCalledWith('change', handler);
});

it('re-renders with new flags when change event fires', async () => {
  const mockClient = makeMockClient();
  (mockClient.allFlags as jest.Mock).mockReturnValue({ 'flag-a': false });

  const captured: Record<string, unknown>[] = [];

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagsConsumer onFlags={(f) => captured.push(f)} />
    </Wrapper>,
  );

  expect(captured[captured.length - 1]).toEqual({ 'flag-a': false });

  (mockClient.allFlags as jest.Mock).mockReturnValue({ 'flag-a': true });

  await act(async () => {
    mockClient.emitChange();
  });

  expect(captured[captured.length - 1]).toEqual({ 'flag-a': true });
});

it('does not re-render when a different key changes', async () => {
  const mockClient = makeMockClient();
  (mockClient.allFlags as jest.Mock).mockReturnValue({ 'flag-a': false, 'flag-b': false });

  let renderCount = 0;

  function CountingConsumer() {
    const flags = useFlags();
    renderCount += 1;
    return <span>{JSON.stringify(flags)}</span>;
  }

  const contextValue: LDReactClientContextValue = {
    client: mockClient,
    initializedState: 'unknown',
  };

  render(
    <LDReactContext.Provider value={contextValue}>
      <CountingConsumer />
    </LDReactContext.Provider>,
  );

  const initialRenders = renderCount;

  // useFlags subscribes to 'change' (all flags), so any flag change triggers re-render.
  // This test verifies that flag-specific change (change:flag-b) does NOT trigger useFlags.
  await act(async () => {
    mockClient.emitFlagChange('flag-b');
  });

  // 'change:flag-b' should not trigger the 'change' handler used by useFlags
  expect(renderCount).toBe(initialRenders);
});
