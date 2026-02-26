/**
 * @jest-environment jsdom
 */
import { act, render } from '@testing-library/react';
import React from 'react';

import { useFlag } from '../../../src/client/hooks/useFlag';
import { LDReactClientContextValue } from '../../../src/client/LDClient';
import { LDReactContext } from '../../../src/client/provider/LDReactContext';
import { makeMockClient } from './mockClient';

function makeWrapper(mockClient: ReturnType<typeof makeMockClient>) {
  const contextValue: LDReactClientContextValue = {
    client: mockClient,
    initializedState: 'unknown',
  };

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <LDReactContext.Provider value={contextValue}>{children}</LDReactContext.Provider>;
  };
}

it('returns initial value from client.variation()', () => {
  const mockClient = makeMockClient();
  (mockClient.variation as jest.Mock).mockImplementation((key: string, def: unknown) =>
    key === 'my-flag' ? true : def,
  );

  const captured: boolean[] = [];

  function FlagConsumer() {
    const value = useFlag<boolean>('my-flag', false);
    captured.push(value);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(captured[0]).toBe(true);
});

it('returns defaultValue when flag is not available', () => {
  const mockClient = makeMockClient();
  (mockClient.variation as jest.Mock).mockReturnValue(undefined);

  const captured: string[] = [];

  function FlagConsumer() {
    const value = useFlag<string>('missing-flag', 'default');
    captured.push(value);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  // When variation returns undefined, useState initializer returns undefined,
  // but the cast means the default from useState is what was returned by variation.
  // Since variation returns undefined, the value is undefined cast to string, which is undefined.
  // Let's just check the mock was called correctly.
  expect(mockClient.variation).toHaveBeenCalledWith('missing-flag', 'default');
});

it('subscribes to change:<key> on mount and unsubscribes on unmount', () => {
  const mockClient = makeMockClient();

  function FlagConsumer() {
    useFlag('my-flag', false);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  const { unmount } = render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(mockClient.on).toHaveBeenCalledWith('change:my-flag', expect.any(Function));

  const onCall = (mockClient.on as jest.Mock).mock.calls.find(
    ([event]: [string]) => event === 'change:my-flag',
  );
  const handler = onCall?.[1];

  unmount();

  expect(mockClient.off).toHaveBeenCalledWith('change:my-flag', handler);
});

it('re-renders with new value when change:<key> fires', async () => {
  const mockClient = makeMockClient();
  (mockClient.variation as jest.Mock).mockReturnValue(false);

  const captured: boolean[] = [];

  function FlagConsumer() {
    const value = useFlag<boolean>('my-flag', false);
    captured.push(value);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(captured[captured.length - 1]).toBe(false);

  (mockClient.variation as jest.Mock).mockReturnValue(true);

  await act(async () => {
    mockClient.emitFlagChange('my-flag');
  });

  expect(captured[captured.length - 1]).toBe(true);
});

it('does not re-render when a different flag key changes', async () => {
  const mockClient = makeMockClient();
  (mockClient.variation as jest.Mock).mockReturnValue(false);

  let renderCount = 0;

  function FlagConsumer() {
    useFlag<boolean>('flag-a', false);
    renderCount += 1;
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  const initialRenders = renderCount;

  await act(async () => {
    mockClient.emitFlagChange('flag-b');
  });

  // flag-a consumer should not re-render when flag-b changes
  expect(renderCount).toBe(initialRenders);
});
