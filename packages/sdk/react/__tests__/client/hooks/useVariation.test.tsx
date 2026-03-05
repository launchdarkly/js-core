/**
 * @jest-environment jsdom
 */
import { act, render } from '@testing-library/react';
import React from 'react';

import {
  useBoolVariation,
  useJsonVariation,
  useNumberVariation,
  useStringVariation,
} from '../../../src/client/hooks/useVariation';
import { LDReactClientContextValue } from '../../../src/client/LDClient';
import { LDReactContext } from '../../../src/client/provider/LDReactContext';
import { makeMockClient } from '../mockClient';

function makeWrapper(mockClient: ReturnType<typeof makeMockClient>) {
  const contextValue: LDReactClientContextValue = {
    client: mockClient,
    initializedState: 'unknown',
  };

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <LDReactContext.Provider value={contextValue}>{children}</LDReactContext.Provider>;
  };
}

// useBoolVariation

it('useBoolVariation calls client.boolVariation with key and defaultValue', () => {
  const mockClient = makeMockClient();
  (mockClient.boolVariation as jest.Mock).mockReturnValue(true);

  const captured: boolean[] = [];

  function FlagConsumer() {
    const value = useBoolVariation('my-flag', false);
    captured.push(value);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(mockClient.boolVariation).toHaveBeenCalledWith('my-flag', false);
  expect(captured[0]).toBe(true);
});

it('useBoolVariation subscribes to change:<key> on mount and unsubscribes on unmount', () => {
  const mockClient = makeMockClient();

  function FlagConsumer() {
    useBoolVariation('my-flag', false);
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

it('useBoolVariation re-renders with new value when change:<key> fires', async () => {
  const mockClient = makeMockClient();
  (mockClient.boolVariation as jest.Mock).mockReturnValue(false);

  const captured: boolean[] = [];

  function FlagConsumer() {
    const value = useBoolVariation('my-flag', false);
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

  (mockClient.boolVariation as jest.Mock).mockReturnValue(true);

  await act(async () => {
    mockClient.emitFlagChange('my-flag');
  });

  expect(captured[captured.length - 1]).toBe(true);
});

it('useBoolVariation does not re-render when a different flag key changes', async () => {
  const mockClient = makeMockClient();
  (mockClient.boolVariation as jest.Mock).mockReturnValue(false);

  let renderCount = 0;

  function FlagConsumer() {
    useBoolVariation('flag-a', false);
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

  expect(renderCount).toBe(initialRenders);
});

it('useBoolVariation calls variation again when context changes after identify', () => {
  const mockClient = makeMockClient();
  (mockClient.boolVariation as jest.Mock).mockReturnValue(true);

  let setContextValue!: React.Dispatch<React.SetStateAction<LDReactClientContextValue>>;

  function StatefulWrapper({ children }: { children: React.ReactNode }) {
    const [ctxValue, setCtx] = React.useState<LDReactClientContextValue>({
      client: mockClient,
      initializedState: 'complete',
    });
    setContextValue = setCtx;
    return <LDReactContext.Provider value={ctxValue}>{children}</LDReactContext.Provider>;
  }

  function FlagConsumer() {
    useBoolVariation('my-flag', false);
    return null;
  }

  render(
    <StatefulWrapper>
      <FlagConsumer />
    </StatefulWrapper>,
  );

  const callsBefore = (mockClient.boolVariation as jest.Mock).mock.calls.length;

  act(() => {
    setContextValue({
      client: mockClient,
      context: { kind: 'user', key: 'new-user' },
      initializedState: 'complete',
    });
  });

  expect((mockClient.boolVariation as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
});

it('useBoolVariation updates value immediately when key changes without waiting for change event', () => {
  const mockClient = makeMockClient();
  (mockClient.boolVariation as jest.Mock).mockImplementation((key: string, def: boolean) => {
    if (key === 'flag-a') return false;
    if (key === 'flag-b') return true;
    return def;
  });

  const captured: boolean[] = [];

  function FlagConsumer({ flagKey }: { flagKey: string }) {
    const value = useBoolVariation(flagKey, false);
    captured.push(value);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  const { rerender } = render(
    <Wrapper>
      <FlagConsumer flagKey="flag-a" />
    </Wrapper>,
  );

  expect(captured[captured.length - 1]).toBe(false);

  rerender(
    <Wrapper>
      <FlagConsumer flagKey="flag-b" />
    </Wrapper>,
  );

  expect(captured[captured.length - 1]).toBe(true);
  expect(mockClient.boolVariation).toHaveBeenCalledWith('flag-b', false);
});

it('useBoolVariation does not re-subscribe when parent re-renders with same props', () => {
  const mockClient = makeMockClient();
  (mockClient.boolVariation as jest.Mock).mockReturnValue(false);

  let setParentState!: (n: number) => void;

  const Wrapper = makeWrapper(mockClient);

  function FlagConsumer({ n: _ }: { n: number }) {
    useBoolVariation('my-flag', false);
    return null;
  }

  function Parent() {
    const [n, setN] = React.useState(0);
    setParentState = setN;
    return (
      <Wrapper>
        <FlagConsumer n={n} />
      </Wrapper>
    );
  }

  render(<Parent />);

  const onCallsBefore = (mockClient.on as jest.Mock).mock.calls.length;

  act(() => {
    setParentState(1);
  });
  act(() => {
    setParentState(2);
  });

  expect((mockClient.on as jest.Mock).mock.calls.length).toBe(onCallsBefore);
});

// useStringVariation

it('useStringVariation calls client.stringVariation with key and defaultValue', () => {
  const mockClient = makeMockClient();
  (mockClient.stringVariation as jest.Mock).mockReturnValue('hello');

  const captured: string[] = [];

  function FlagConsumer() {
    const value = useStringVariation('my-flag', 'default');
    captured.push(value);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(mockClient.stringVariation).toHaveBeenCalledWith('my-flag', 'default');
  expect(captured[0]).toBe('hello');
});

it('useStringVariation re-renders with new value when change:<key> fires', async () => {
  const mockClient = makeMockClient();
  (mockClient.stringVariation as jest.Mock).mockReturnValue('before');

  const captured: string[] = [];

  function FlagConsumer() {
    const value = useStringVariation('my-flag', 'default');
    captured.push(value);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  (mockClient.stringVariation as jest.Mock).mockReturnValue('after');

  await act(async () => {
    mockClient.emitFlagChange('my-flag');
  });

  expect(captured[captured.length - 1]).toBe('after');
});

it('useStringVariation calls variation again when context changes', () => {
  const mockClient = makeMockClient();
  (mockClient.stringVariation as jest.Mock).mockReturnValue('value');

  let setContextValue!: React.Dispatch<React.SetStateAction<LDReactClientContextValue>>;

  function StatefulWrapper({ children }: { children: React.ReactNode }) {
    const [ctxValue, setCtx] = React.useState<LDReactClientContextValue>({
      client: mockClient,
      initializedState: 'complete',
    });
    setContextValue = setCtx;
    return <LDReactContext.Provider value={ctxValue}>{children}</LDReactContext.Provider>;
  }

  function FlagConsumer() {
    useStringVariation('my-flag', 'default');
    return null;
  }

  render(
    <StatefulWrapper>
      <FlagConsumer />
    </StatefulWrapper>,
  );

  const callsBefore = (mockClient.stringVariation as jest.Mock).mock.calls.length;

  act(() => {
    setContextValue({
      client: mockClient,
      context: { kind: 'user', key: 'new-user' },
      initializedState: 'complete',
    });
  });

  expect((mockClient.stringVariation as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
});

// useNumberVariation

it('useNumberVariation calls client.numberVariation with key and defaultValue', () => {
  const mockClient = makeMockClient();
  (mockClient.numberVariation as jest.Mock).mockReturnValue(42);

  const captured: number[] = [];

  function FlagConsumer() {
    const value = useNumberVariation('my-flag', 0);
    captured.push(value);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(mockClient.numberVariation).toHaveBeenCalledWith('my-flag', 0);
  expect(captured[0]).toBe(42);
});

it('useNumberVariation re-renders with new value when change:<key> fires', async () => {
  const mockClient = makeMockClient();
  (mockClient.numberVariation as jest.Mock).mockReturnValue(1);

  const captured: number[] = [];

  function FlagConsumer() {
    const value = useNumberVariation('my-flag', 0);
    captured.push(value);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  (mockClient.numberVariation as jest.Mock).mockReturnValue(99);

  await act(async () => {
    mockClient.emitFlagChange('my-flag');
  });

  expect(captured[captured.length - 1]).toBe(99);
});

it('useNumberVariation calls variation again when context changes', () => {
  const mockClient = makeMockClient();
  (mockClient.numberVariation as jest.Mock).mockReturnValue(5);

  let setContextValue!: React.Dispatch<React.SetStateAction<LDReactClientContextValue>>;

  function StatefulWrapper({ children }: { children: React.ReactNode }) {
    const [ctxValue, setCtx] = React.useState<LDReactClientContextValue>({
      client: mockClient,
      initializedState: 'complete',
    });
    setContextValue = setCtx;
    return <LDReactContext.Provider value={ctxValue}>{children}</LDReactContext.Provider>;
  }

  function FlagConsumer() {
    useNumberVariation('my-flag', 0);
    return null;
  }

  render(
    <StatefulWrapper>
      <FlagConsumer />
    </StatefulWrapper>,
  );

  const callsBefore = (mockClient.numberVariation as jest.Mock).mock.calls.length;

  act(() => {
    setContextValue({
      client: mockClient,
      context: { kind: 'user', key: 'new-user' },
      initializedState: 'complete',
    });
  });

  expect((mockClient.numberVariation as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
});

// useJsonVariation

it('useJsonVariation calls client.jsonVariation with key and defaultValue', () => {
  const mockClient = makeMockClient();
  const result = { enabled: true };
  (mockClient.jsonVariation as jest.Mock).mockReturnValue(result);

  const captured: object[] = [];

  function FlagConsumer() {
    const value = useJsonVariation('my-flag', {});
    captured.push(value);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(mockClient.jsonVariation).toHaveBeenCalledWith('my-flag', {});
  expect(captured[0]).toEqual(result);
});

it('useJsonVariation re-renders with new value when change:<key> fires', async () => {
  const mockClient = makeMockClient();
  (mockClient.jsonVariation as jest.Mock).mockReturnValue({ x: 1 });

  const captured: unknown[] = [];

  function FlagConsumer() {
    const value = useJsonVariation('my-flag', {});
    captured.push(value);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  (mockClient.jsonVariation as jest.Mock).mockReturnValue({ x: 2 });

  await act(async () => {
    mockClient.emitFlagChange('my-flag');
  });

  expect(captured[captured.length - 1]).toEqual({ x: 2 });
});

it('useJsonVariation does not re-subscribe when parent re-renders with inline object defaultValue', () => {
  const mockClient = makeMockClient();
  (mockClient.jsonVariation as jest.Mock).mockReturnValue({ enabled: false });

  let setParentState!: (n: number) => void;

  const Wrapper = makeWrapper(mockClient);

  function FlagConsumer({ n: _ }: { n: number }) {
    useJsonVariation('my-flag', {});
    return null;
  }

  function Parent() {
    const [n, setN] = React.useState(0);
    setParentState = setN;
    return (
      <Wrapper>
        <FlagConsumer n={n} />
      </Wrapper>
    );
  }

  render(<Parent />);

  const onCallsBefore = (mockClient.on as jest.Mock).mock.calls.length;

  act(() => {
    setParentState(1);
  });
  act(() => {
    setParentState(2);
  });

  expect((mockClient.on as jest.Mock).mock.calls.length).toBe(onCallsBefore);
});

it('useJsonVariation calls variation again when context changes', () => {
  const mockClient = makeMockClient();
  (mockClient.jsonVariation as jest.Mock).mockReturnValue({ value: 'a' });

  let setContextValue!: React.Dispatch<React.SetStateAction<LDReactClientContextValue>>;

  function StatefulWrapper({ children }: { children: React.ReactNode }) {
    const [ctxValue, setCtx] = React.useState<LDReactClientContextValue>({
      client: mockClient,
      initializedState: 'complete',
    });
    setContextValue = setCtx;
    return <LDReactContext.Provider value={ctxValue}>{children}</LDReactContext.Provider>;
  }

  function FlagConsumer() {
    useJsonVariation('my-flag', {});
    return null;
  }

  render(
    <StatefulWrapper>
      <FlagConsumer />
    </StatefulWrapper>,
  );

  const callsBefore = (mockClient.jsonVariation as jest.Mock).mock.calls.length;

  act(() => {
    setContextValue({
      client: mockClient,
      context: { kind: 'user', key: 'new-user' },
      initializedState: 'complete',
    });
  });

  expect((mockClient.jsonVariation as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
});
