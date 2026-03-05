/**
 * @jest-environment jsdom
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { useInitializationStatus } from '../../../src/client/hooks/useInitializationStatus';
import { useLDClient } from '../../../src/client/hooks/useLDClient';
import { useBoolVariation } from '../../../src/client/hooks/useVariation';
import { LDReactClient } from '../../../src/client/LDClient';
import { initLDReactContext } from '../../../src/client/provider/LDReactContext';
import { createLDReactProviderWithClient } from '../../../src/client/provider/LDReactProvider';
import { makeMockClient } from '../mockClient';

it('useBoolVariation reads from each respective client when using separate contexts', () => {
  const ContextA = initLDReactContext();
  const ContextB = initLDReactContext();

  const clientA = makeMockClient();
  const clientB = makeMockClient();

  (clientA.boolVariation as jest.Mock).mockReturnValue(true);
  (clientB.boolVariation as jest.Mock).mockReturnValue(false);

  const ProviderA = createLDReactProviderWithClient(clientA, ContextA);
  const ProviderB = createLDReactProviderWithClient(clientB, ContextB);

  let valueA: boolean = false;
  let valueB: boolean = true;

  function Consumer() {
    valueA = useBoolVariation('feature-flag', false, ContextA);
    valueB = useBoolVariation('feature-flag', false, ContextB);
    return null;
  }

  render(
    <ProviderA>
      <ProviderB>
        <Consumer />
      </ProviderB>
    </ProviderA>,
  );

  expect(clientA.boolVariation).toHaveBeenCalledWith('feature-flag', false);
  expect(clientB.boolVariation).toHaveBeenCalledWith('feature-flag', false);
  expect(valueA).toBe(true);
  expect(valueB).toBe(false);
});

it('useBoolVariation calls boolVariation on the correct client for each context', () => {
  const ContextA = initLDReactContext();
  const ContextB = initLDReactContext();

  const clientA = makeMockClient();
  const clientB = makeMockClient();

  (clientA.boolVariation as jest.Mock).mockReturnValue(true);
  (clientB.boolVariation as jest.Mock).mockReturnValue(false);

  const ProviderA = createLDReactProviderWithClient(clientA, ContextA);
  const ProviderB = createLDReactProviderWithClient(clientB, ContextB);

  let valueA: boolean = false;
  let valueB: boolean = true;

  function Consumer() {
    valueA = useBoolVariation('my-flag', false, ContextA);
    valueB = useBoolVariation('my-flag', false, ContextB);
    return null;
  }

  render(
    <ProviderA>
      <ProviderB>
        <Consumer />
      </ProviderB>
    </ProviderA>,
  );

  expect(clientA.boolVariation).toHaveBeenCalledWith('my-flag', false);
  expect(clientB.boolVariation).toHaveBeenCalledWith('my-flag', false);
  expect(valueA).toBe(true);
  expect(valueB).toBe(false);
});

it('useLDClient returns the respective client for each context', () => {
  const ContextA = initLDReactContext();
  const ContextB = initLDReactContext();

  const clientA = makeMockClient();
  const clientB = makeMockClient();

  const ProviderA = createLDReactProviderWithClient(clientA, ContextA);
  const ProviderB = createLDReactProviderWithClient(clientB, ContextB);

  let returnedClientA: LDReactClient | undefined;
  let returnedClientB: LDReactClient | undefined;

  function Consumer() {
    returnedClientA = useLDClient(ContextA);
    returnedClientB = useLDClient(ContextB);
    return null;
  }

  render(
    <ProviderA>
      <ProviderB>
        <Consumer />
      </ProviderB>
    </ProviderA>,
  );

  expect(returnedClientA).toBe(clientA);
  expect(returnedClientB).toBe(clientB);
});

it('initialization state is tracked independently per context', async () => {
  const ContextA = initLDReactContext();
  const ContextB = initLDReactContext();

  const clientA = makeMockClient();
  const clientB = makeMockClient();

  const ProviderA = createLDReactProviderWithClient(clientA, ContextA);
  const ProviderB = createLDReactProviderWithClient(clientB, ContextB);

  const statusValues: { a: string; b: string }[] = [];

  function Consumer() {
    const { status: statusA } = useInitializationStatus(ContextA);
    const { status: statusB } = useInitializationStatus(ContextB);
    statusValues.push({ a: statusA, b: statusB });
    return (
      <>
        <span data-testid="status-a">{statusA}</span>
        <span data-testid="status-b">{statusB}</span>
      </>
    );
  }

  render(
    <ProviderA>
      <ProviderB>
        <Consumer />
      </ProviderB>
    </ProviderA>,
  );

  expect(screen.getByTestId('status-a').textContent).toBe('unknown');
  expect(screen.getByTestId('status-b').textContent).toBe('unknown');

  await act(async () => {
    clientA.fireInitStatusChange('complete');
  });

  await waitFor(() => {
    expect(screen.getByTestId('status-a').textContent).toBe('complete');
  });
  // clientB still unknown
  expect(screen.getByTestId('status-b').textContent).toBe('unknown');

  await act(async () => {
    clientB.fireInitStatusChange('complete');
  });

  await waitFor(() => {
    expect(screen.getByTestId('status-b').textContent).toBe('complete');
  });
  expect(screen.getByTestId('status-a').textContent).toBe('complete');
});
