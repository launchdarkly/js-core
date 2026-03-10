/**
 * @jest-environment jsdom
 */
import { act, render } from '@testing-library/react';
import React from 'react';

import { useFlags } from '../../../src/client/deprecated-hooks/useFlags';
import { makeMockClient } from '../mockClient';
import { makeStatefulWrapper, makeWrapper } from './renderHelpers';

function FlagsConsumer({ onFlags }: { onFlags: (flags: Record<string, unknown>) => void }) {
  const flags = useFlags();
  onFlags(flags);
  return <span data-testid="output">{JSON.stringify(flags)}</span>;
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

it('logs a deprecation warning on mount via client.logger.warn', async () => {
  const mockClient = makeMockClient();
  const Wrapper = makeWrapper(mockClient);

  function FlagConsumer() {
    useFlags();
    return null;
  }

  await act(async () => {
    render(
      <Wrapper>
        <FlagConsumer />
      </Wrapper>,
    );
  });

  expect(mockClient.logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('[LaunchDarkly] useFlags is deprecated'),
  );
});

it('clears the variation cache when the context changes after identify', () => {
  const mockClient = makeMockClient();
  (mockClient.allFlags as jest.Mock).mockReturnValue({ 'my-flag': true });

  const { Wrapper: StatefulWrapper, setterRef } = makeStatefulWrapper(mockClient);

  let capturedFlags: Record<string, unknown> = {};

  function FlagReader() {
    capturedFlags = useFlags();
    return null;
  }

  render(
    <StatefulWrapper>
      <FlagReader />
    </StatefulWrapper>,
  );

  // Read the flag to prime the variation cache
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  capturedFlags['my-flag'];
  const callsBefore = (mockClient.variation as jest.Mock).mock.calls.length;

  // Simulate context change (e.g. after identify)
  act(() => {
    setterRef.current!({
      client: mockClient,
      context: { kind: 'user', key: 'new-user' },
      initializedState: 'complete',
    });
  });

  // Reading the same key again should call variation again (cache was cleared)
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  capturedFlags['my-flag'];
  expect((mockClient.variation as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
});

it('calls client.variation when reading a flag value from the returned object', () => {
  const mockClient = makeMockClient();
  (mockClient.allFlags as jest.Mock).mockReturnValue({ 'my-flag': true });

  let capturedFlags: Record<string, unknown> = {};

  function FlagReader() {
    capturedFlags = useFlags();
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagReader />
    </Wrapper>,
  );

  // Reading a flag through the proxy should call variation, not just return the allFlags value
  const value = capturedFlags['my-flag'];
  expect(mockClient.variation).toHaveBeenCalledWith('my-flag', true);
  expect(value).toBe(true);
});

it('calls client.variation only once per flag key when the same key is read multiple times', () => {
  const mockClient = makeMockClient();
  (mockClient.allFlags as jest.Mock).mockReturnValue({ 'my-flag': true });

  let capturedFlags: Record<string, unknown> = {};

  function FlagReader() {
    capturedFlags = useFlags();
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagReader />
    </Wrapper>,
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  capturedFlags['my-flag'];

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  capturedFlags['my-flag'];

  const calls = (mockClient.variation as jest.Mock).mock.calls.filter(
    ([key]: [string]) => key === 'my-flag',
  );
  expect(calls).toHaveLength(1);
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

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <CountingConsumer />
    </Wrapper>,
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
