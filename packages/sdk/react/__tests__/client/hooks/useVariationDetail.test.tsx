/**
 * @jest-environment jsdom
 */
import { act, render } from '@testing-library/react';
import React from 'react';

import type { LDEvaluationDetailTyped } from '@launchdarkly/js-client-sdk';

import {
  useBoolVariationDetail,
  useJsonVariationDetail,
  useNumberVariationDetail,
  useStringVariationDetail,
} from '../../../src/client/hooks/useVariationDetail';
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

// useBoolVariationDetail

it('useBoolVariationDetail calls client.boolVariationDetail and returns detail', () => {
  const mockClient = makeMockClient();
  const detail: LDEvaluationDetailTyped<boolean> = {
    value: true,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  (mockClient.boolVariationDetail as jest.Mock).mockReturnValue(detail);

  const captured: LDEvaluationDetailTyped<boolean>[] = [];

  function FlagConsumer() {
    const d = useBoolVariationDetail('my-flag', false);
    captured.push(d);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(mockClient.boolVariationDetail).toHaveBeenCalledWith('my-flag', false);
  expect(captured[0]).toEqual(detail);
});

it('useBoolVariationDetail subscribes to change:<key> on mount and unsubscribes on unmount', () => {
  const mockClient = makeMockClient();
  (mockClient.boolVariationDetail as jest.Mock).mockReturnValue({
    value: false,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

  function FlagConsumer() {
    useBoolVariationDetail('my-flag', false);
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

it('useBoolVariationDetail re-renders with updated detail when change:<key> fires', async () => {
  const mockClient = makeMockClient();
  const initialDetail: LDEvaluationDetailTyped<boolean> = {
    value: false,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  const updatedDetail: LDEvaluationDetailTyped<boolean> = {
    value: true,
    variationIndex: 1,
    reason: { kind: 'FALLTHROUGH' },
  };
  (mockClient.boolVariationDetail as jest.Mock).mockReturnValue(initialDetail);

  const captured: LDEvaluationDetailTyped<boolean>[] = [];

  function FlagConsumer() {
    const d = useBoolVariationDetail('my-flag', false);
    captured.push(d);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(captured[captured.length - 1]).toEqual(initialDetail);

  (mockClient.boolVariationDetail as jest.Mock).mockReturnValue(updatedDetail);

  await act(async () => {
    mockClient.emitFlagChange('my-flag');
  });

  expect(captured[captured.length - 1]).toEqual(updatedDetail);
});

it('useBoolVariationDetail calls variation detail again when context changes', () => {
  const mockClient = makeMockClient();
  (mockClient.boolVariationDetail as jest.Mock).mockReturnValue({
    value: true,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

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
    useBoolVariationDetail('my-flag', false);
    return null;
  }

  render(
    <StatefulWrapper>
      <FlagConsumer />
    </StatefulWrapper>,
  );

  const callsBefore = (mockClient.boolVariationDetail as jest.Mock).mock.calls.length;

  act(() => {
    setContextValue({
      client: mockClient,
      context: { kind: 'user', key: 'new-user' },
      initializedState: 'complete',
    });
  });

  expect((mockClient.boolVariationDetail as jest.Mock).mock.calls.length).toBeGreaterThan(
    callsBefore,
  );
});

it('useBoolVariationDetail updates detail immediately when key changes', () => {
  const mockClient = makeMockClient();
  const detailA: LDEvaluationDetailTyped<boolean> = {
    value: false,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  const detailB: LDEvaluationDetailTyped<boolean> = {
    value: true,
    variationIndex: 1,
    reason: { kind: 'FALLTHROUGH' },
  };
  (mockClient.boolVariationDetail as jest.Mock).mockImplementation((key: string, _def: boolean) => {
    if (key === 'flag-a') return detailA;
    if (key === 'flag-b') return detailB;
    return detailA;
  });

  const captured: LDEvaluationDetailTyped<boolean>[] = [];

  function FlagConsumer({ flagKey }: { flagKey: string }) {
    const d = useBoolVariationDetail(flagKey, false);
    captured.push(d);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  const { rerender } = render(
    <Wrapper>
      <FlagConsumer flagKey="flag-a" />
    </Wrapper>,
  );

  expect(captured[captured.length - 1]).toEqual(detailA);

  rerender(
    <Wrapper>
      <FlagConsumer flagKey="flag-b" />
    </Wrapper>,
  );

  expect(captured[captured.length - 1]).toEqual(detailB);
  expect(mockClient.boolVariationDetail).toHaveBeenCalledWith('flag-b', false);
});

// useStringVariationDetail

it('useStringVariationDetail calls client.stringVariationDetail and returns detail', () => {
  const mockClient = makeMockClient();
  const detail: LDEvaluationDetailTyped<string> = {
    value: 'on',
    variationIndex: 1,
    reason: { kind: 'RULE_MATCH', ruleIndex: 0, ruleId: 'r1' },
  };
  (mockClient.stringVariationDetail as jest.Mock).mockReturnValue(detail);

  const captured: LDEvaluationDetailTyped<string>[] = [];

  function FlagConsumer() {
    const d = useStringVariationDetail('my-flag', 'off');
    captured.push(d);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(mockClient.stringVariationDetail).toHaveBeenCalledWith('my-flag', 'off');
  expect(captured[0]).toEqual(detail);
});

it('useStringVariationDetail re-renders with updated detail when change:<key> fires', async () => {
  const mockClient = makeMockClient();
  const initialDetail: LDEvaluationDetailTyped<string> = {
    value: 'before',
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  const updatedDetail: LDEvaluationDetailTyped<string> = {
    value: 'after',
    variationIndex: 1,
    reason: { kind: 'FALLTHROUGH' },
  };
  (mockClient.stringVariationDetail as jest.Mock).mockReturnValue(initialDetail);

  const captured: LDEvaluationDetailTyped<string>[] = [];

  function FlagConsumer() {
    const d = useStringVariationDetail('my-flag', 'default');
    captured.push(d);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  (mockClient.stringVariationDetail as jest.Mock).mockReturnValue(updatedDetail);

  await act(async () => {
    mockClient.emitFlagChange('my-flag');
  });

  expect(captured[captured.length - 1]).toEqual(updatedDetail);
});

it('useStringVariationDetail calls variation detail again when context changes', () => {
  const mockClient = makeMockClient();
  (mockClient.stringVariationDetail as jest.Mock).mockReturnValue({
    value: 'value',
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

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
    useStringVariationDetail('my-flag', 'default');
    return null;
  }

  render(
    <StatefulWrapper>
      <FlagConsumer />
    </StatefulWrapper>,
  );

  const callsBefore = (mockClient.stringVariationDetail as jest.Mock).mock.calls.length;

  act(() => {
    setContextValue({
      client: mockClient,
      context: { kind: 'user', key: 'new-user' },
      initializedState: 'complete',
    });
  });

  expect((mockClient.stringVariationDetail as jest.Mock).mock.calls.length).toBeGreaterThan(
    callsBefore,
  );
});

// useNumberVariationDetail

it('useNumberVariationDetail calls client.numberVariationDetail and returns detail', () => {
  const mockClient = makeMockClient();
  const detail: LDEvaluationDetailTyped<number> = {
    value: 99,
    variationIndex: 2,
    reason: { kind: 'FALLTHROUGH' },
  };
  (mockClient.numberVariationDetail as jest.Mock).mockReturnValue(detail);

  const captured: LDEvaluationDetailTyped<number>[] = [];

  function FlagConsumer() {
    const d = useNumberVariationDetail('my-flag', 0);
    captured.push(d);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(mockClient.numberVariationDetail).toHaveBeenCalledWith('my-flag', 0);
  expect(captured[0]).toEqual(detail);
});

it('useNumberVariationDetail re-renders with updated detail when change:<key> fires', async () => {
  const mockClient = makeMockClient();
  const initialDetail: LDEvaluationDetailTyped<number> = {
    value: 1,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  const updatedDetail: LDEvaluationDetailTyped<number> = {
    value: 99,
    variationIndex: 1,
    reason: { kind: 'FALLTHROUGH' },
  };
  (mockClient.numberVariationDetail as jest.Mock).mockReturnValue(initialDetail);

  const captured: LDEvaluationDetailTyped<number>[] = [];

  function FlagConsumer() {
    const d = useNumberVariationDetail('my-flag', 0);
    captured.push(d);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  (mockClient.numberVariationDetail as jest.Mock).mockReturnValue(updatedDetail);

  await act(async () => {
    mockClient.emitFlagChange('my-flag');
  });

  expect(captured[captured.length - 1]).toEqual(updatedDetail);
});

it('useNumberVariationDetail calls variation detail again when context changes', () => {
  const mockClient = makeMockClient();
  (mockClient.numberVariationDetail as jest.Mock).mockReturnValue({
    value: 5,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

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
    useNumberVariationDetail('my-flag', 0);
    return null;
  }

  render(
    <StatefulWrapper>
      <FlagConsumer />
    </StatefulWrapper>,
  );

  const callsBefore = (mockClient.numberVariationDetail as jest.Mock).mock.calls.length;

  act(() => {
    setContextValue({
      client: mockClient,
      context: { kind: 'user', key: 'new-user' },
      initializedState: 'complete',
    });
  });

  expect((mockClient.numberVariationDetail as jest.Mock).mock.calls.length).toBeGreaterThan(
    callsBefore,
  );
});

// useJsonVariationDetail

it('useJsonVariationDetail calls client.jsonVariationDetail and returns detail', () => {
  const mockClient = makeMockClient();
  const detail: LDEvaluationDetailTyped<object> = {
    value: { x: 1 },
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  (mockClient.jsonVariationDetail as jest.Mock).mockReturnValue(detail);

  const captured: LDEvaluationDetailTyped<object>[] = [];

  function FlagConsumer() {
    const d = useJsonVariationDetail('my-flag', {});
    captured.push(d);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  expect(mockClient.jsonVariationDetail).toHaveBeenCalledWith('my-flag', {});
  expect(captured[0]).toEqual(detail);
});

it('useJsonVariationDetail re-renders with updated detail when change:<key> fires', async () => {
  const mockClient = makeMockClient();
  const initialDetail: LDEvaluationDetailTyped<object> = {
    value: { x: 1 },
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  const updatedDetail: LDEvaluationDetailTyped<object> = {
    value: { x: 2 },
    variationIndex: 1,
    reason: { kind: 'FALLTHROUGH' },
  };
  (mockClient.jsonVariationDetail as jest.Mock).mockReturnValue(initialDetail);

  const captured: LDEvaluationDetailTyped<object>[] = [];

  function FlagConsumer() {
    const d = useJsonVariationDetail('my-flag', {});
    captured.push(d);
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  (mockClient.jsonVariationDetail as jest.Mock).mockReturnValue(updatedDetail);

  await act(async () => {
    mockClient.emitFlagChange('my-flag');
  });

  expect(captured[captured.length - 1]).toEqual(updatedDetail);
});

it('useJsonVariationDetail calls variation detail again when context changes', () => {
  const mockClient = makeMockClient();
  (mockClient.jsonVariationDetail as jest.Mock).mockReturnValue({
    value: { a: 1 },
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

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
    useJsonVariationDetail('my-flag', {});
    return null;
  }

  render(
    <StatefulWrapper>
      <FlagConsumer />
    </StatefulWrapper>,
  );

  const callsBefore = (mockClient.jsonVariationDetail as jest.Mock).mock.calls.length;

  act(() => {
    setContextValue({
      client: mockClient,
      context: { kind: 'user', key: 'new-user' },
      initializedState: 'complete',
    });
  });

  expect((mockClient.jsonVariationDetail as jest.Mock).mock.calls.length).toBeGreaterThan(
    callsBefore,
  );
});

it('useJsonVariationDetail does not loop infinitely when defaultValue is an inline object', async () => {
  const mockClient = makeMockClient();
  (mockClient.jsonVariationDetail as jest.Mock).mockReturnValue({
    value: { x: 1 },
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

  let renderCount = 0;

  function FlagConsumer() {
    useJsonVariationDetail('my-flag', {});
    renderCount += 1;
    return null;
  }

  const Wrapper = makeWrapper(mockClient);
  render(
    <Wrapper>
      <FlagConsumer />
    </Wrapper>,
  );

  await act(async () => {});

  expect(renderCount).toBeLessThanOrEqual(3);
});
