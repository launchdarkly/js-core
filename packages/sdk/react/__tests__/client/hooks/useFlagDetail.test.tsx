/**
 * @jest-environment jsdom
 */
import { act, render } from '@testing-library/react';
import React from 'react';

import type { LDEvaluationDetailTyped } from '@launchdarkly/js-client-sdk';

import { useFlagDetail } from '../../../src/client/deprecated-hooks/useFlagDetail';
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

it('dispatches to boolVariationDetail for boolean defaultValue', () => {
  const mockClient = makeMockClient();
  const detail: LDEvaluationDetailTyped<boolean> = {
    value: true,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  (mockClient.boolVariationDetail as jest.Mock).mockReturnValue(detail);

  const captured: LDEvaluationDetailTyped<boolean>[] = [];

  function FlagConsumer() {
    const d = useFlagDetail<boolean>('my-flag', false);
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

it('dispatches to stringVariationDetail for string defaultValue', () => {
  const mockClient = makeMockClient();
  const detail: LDEvaluationDetailTyped<string> = {
    value: 'on',
    variationIndex: 1,
    reason: { kind: 'RULE_MATCH', ruleIndex: 0, ruleId: 'r1' },
  };
  (mockClient.stringVariationDetail as jest.Mock).mockReturnValue(detail);

  const captured: LDEvaluationDetailTyped<string>[] = [];

  function FlagConsumer() {
    const d = useFlagDetail<string>('my-flag', 'off');
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

it('dispatches to numberVariationDetail for number defaultValue', () => {
  const mockClient = makeMockClient();
  const detail: LDEvaluationDetailTyped<number> = {
    value: 99,
    variationIndex: 2,
    reason: { kind: 'FALLTHROUGH' },
  };
  (mockClient.numberVariationDetail as jest.Mock).mockReturnValue(detail);

  const captured: LDEvaluationDetailTyped<number>[] = [];

  function FlagConsumer() {
    const d = useFlagDetail<number>('my-flag', 0);
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

it('dispatches to jsonVariationDetail for object defaultValue', () => {
  const mockClient = makeMockClient();
  const detail: LDEvaluationDetailTyped<object> = {
    value: { x: 1 },
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  (mockClient.jsonVariationDetail as jest.Mock).mockReturnValue(detail);

  const captured: LDEvaluationDetailTyped<object>[] = [];

  function FlagConsumer() {
    const d = useFlagDetail<object>('my-flag', {});
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

it('subscribes to change:<key> on mount and unsubscribes on unmount', () => {
  const mockClient = makeMockClient();
  (mockClient.boolVariationDetail as jest.Mock).mockReturnValue({
    value: false,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

  function FlagConsumer() {
    useFlagDetail('my-flag', false);
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

it('re-renders with updated detail when change:<key> fires', async () => {
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
    const d = useFlagDetail<boolean>('my-flag', false);
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

it('does not loop infinitely when defaultValue is an inline object', async () => {
  const mockClient = makeMockClient();
  (mockClient.jsonVariationDetail as jest.Mock).mockReturnValue({
    value: { x: 1 },
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

  let renderCount = 0;

  function FlagConsumer() {
    useFlagDetail<object>('my-flag', {});
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

it('calls variation detail again when context changes after identify', () => {
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
    useFlagDetail<boolean>('my-flag', false);
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

it('logs a deprecation warning on mount via client.logger.warn', async () => {
  const mockClient = makeMockClient();
  const Wrapper = makeWrapper(mockClient);

  function FlagConsumer() {
    useFlagDetail('my-flag', false);
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
    expect.stringContaining('[LaunchDarkly] useFlagDetail is deprecated'),
  );
});

it('updates detail immediately when key changes without waiting for change event', () => {
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
    const d = useFlagDetail<boolean>(flagKey, false);
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
