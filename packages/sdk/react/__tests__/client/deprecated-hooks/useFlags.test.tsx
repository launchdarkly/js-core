/**
 * @jest-environment jsdom
 */
import { act, render } from '@testing-library/react';
import React from 'react';

import { useFlags } from '../../../src/client/deprecated-hooks/useFlags';
import { LDReactClientContextValue } from '../../../src/client/LDClient';
import { makeMockClient } from '../mockClient';
import { makeStatefulWrapper, makeWrapper } from './renderHelpers';

// ─── camelCase default behavior ───────────────────────────────────────────────

it('returns camelCased keys when useCamelCaseFlagKeys is true', () => {
  const mockClient = makeMockClient({
    flagOverrides: { 'my-flag': true, 'another-flag': 'value' },
  });

  const captured: Record<string, unknown>[] = [];

  function FlagConsumer() {
    const flags = useFlags();
    captured.push({ myFlag: flags.myFlag, anotherFlag: flags.anotherFlag });
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(captured[0].myFlag).toBe(true);
  expect(captured[0].anotherFlag).toBe('value');
});

it('returns original keys when useCamelCaseFlagKeys is false', () => {
  const mockClient = makeMockClient({ flagOverrides: { 'my-flag': true } });
  (mockClient.shouldUseCamelCaseFlagKeys as jest.Mock).mockReturnValue(false);

  let capturedFlags: Record<string, unknown> = {};

  function FlagConsumer() {
    const flags = useFlags();
    capturedFlags = { ...flags };
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(capturedFlags['my-flag']).toBe(true);
  expect(capturedFlags.myFlag).toBeUndefined();
});

it('defaults useCamelCaseFlagKeys to true when not passed', () => {
  const mockClient = makeMockClient({ flagOverrides: { 'kebab-key': 42 } });

  const captured: unknown[] = [];

  function FlagConsumer() {
    const flags = useFlags();
    // @ts-ignore — dynamic access for test
    captured.push(flags.kebabKey);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(captured[0]).toBe(42);
});

// ─── camelCase proxy behavior ─────────────────────────────────────────────────

it('camelCased flags proxy supports `in` operator with camelCase key', () => {
  const mockClient = makeMockClient({ flagOverrides: { 'my-flag': true } });

  const captured: { hasCamel: boolean; hasOriginal: boolean }[] = [];

  function FlagConsumer() {
    const flags = useFlags();
    captured.push({
      hasCamel: 'myFlag' in flags,
      hasOriginal: 'my-flag' in flags,
    });
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(captured[0].hasCamel).toBe(true);
  expect(captured[0].hasOriginal).toBe(false);
});

it('Object.keys() on camelCased proxy returns camelCase keys', () => {
  const mockClient = makeMockClient({ flagOverrides: { 'flag-one': 1, flag_two: 2 } });

  let capturedKeys: string[] = [];

  function FlagConsumer() {
    const flags = useFlags();
    capturedKeys = Object.keys(flags);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(capturedKeys.sort()).toEqual(['flagOne', 'flagTwo'].sort());
});

it('spread of camelCased proxy produces camelCase key-value pairs', () => {
  const mockClient = makeMockClient({ flagOverrides: { 'my-flag': true } });

  let copy: Record<string, unknown> = {};

  function FlagConsumer() {
    const flags = useFlags();
    copy = { ...flags };
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(copy.myFlag).toBe(true);
  expect(copy['my-flag']).toBeUndefined();
});

// ─── Variation recording ──────────────────────────────────────────────────────

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
  const value = capturedFlags.myFlag;
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
  capturedFlags.myFlag;

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  capturedFlags.myFlag;

  const calls = (mockClient.variation as jest.Mock).mock.calls.filter(
    ([key]: [string]) => key === 'my-flag',
  );
  expect(calls).toHaveLength(1);
});

// ─── Change event subscription ────────────────────────────────────────────────

it('subscribes to change event on mount and unsubscribes on unmount', () => {
  const mockClient = makeMockClient();

  function FlagConsumer() {
    useFlags();
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  const { unmount } = render(
    <Wrapper>
      <FlagConsumer />
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

  function FlagsConsumer() {
    const flags = useFlags();
    captured.push(flags);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagsConsumer />
    </Wrapper>,
  );

  expect(captured[captured.length - 1]).toEqual({ flagA: false });

  (mockClient.allFlags as jest.Mock).mockReturnValue({ 'flag-a': true });

  await act(async () => {
    mockClient.emitChange();
  });

  expect(captured[captured.length - 1]).toEqual({ flagA: true });
});

it('re-renders with updated camelCase value when emitChange fires with new flag data', async () => {
  const mockClient = makeMockClient({ flagOverrides: { 'my-flag': false } });

  const captured: unknown[] = [];

  function FlagConsumer() {
    const flags = useFlags();
    // @ts-ignore — dynamic access for test
    captured.push(flags.myFlag);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(captured[captured.length - 1]).toBe(false);

  await act(async () => {
    mockClient.emitChange({ 'my-flag': true });
  });

  expect(captured[captured.length - 1]).toBe(true);
});

it('does not re-render when a flag-specific change event fires', async () => {
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

// ─── Context change (re-identify) ─────────────────────────────────────────────

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
  capturedFlags.myFlag;
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
  capturedFlags.myFlag;
  expect((mockClient.variation as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
});

// ─── Deprecation warning ──────────────────────────────────────────────────────

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

// ─── Custom React context ─────────────────────────────────────────────────────

it('reads flags from a custom react context', () => {
  const mockClient = makeMockClient({ flagOverrides: { 'custom-flag': 'hello' } });
  const CustomContext = React.createContext<LDReactClientContextValue>(null as any);

  const captured: unknown[] = [];

  function FlagConsumer() {
    const flags = useFlags(CustomContext);
    // @ts-ignore — dynamic access for test
    captured.push(flags.customFlag);
    return null;
  }

  const ctxValue: LDReactClientContextValue = {
    client: mockClient,
    initializedState: 'complete',
  };

  render(
    <CustomContext.Provider value={ctxValue}>
      <FlagConsumer />
    </CustomContext.Provider>,
  );

  expect(captured[0]).toBe('hello');
});

// ─── $ system key filtering ────────────────────────────────────────────────────

it('filters out $ system keys from the returned flags object', () => {
  const mockClient = makeMockClient({
    flagOverrides: { 'my-flag': true, '$system-key': 'internal' },
  });

  let capturedKeys: string[] = [];

  function FlagConsumer() {
    const flags = useFlags();
    capturedKeys = Object.keys(flags);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(capturedKeys).toContain('myFlag');
  expect(capturedKeys).not.toContain('$systemKey');
  expect(capturedKeys).not.toContain('$system-key');
});
