/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';

import { useLDClient } from '../../../src/client/hooks/useLDClient';
import { LDReactClientContextValue } from '../../../src/client/LDClient';
import { LDReactContext } from '../../../src/client/provider/LDReactContext';
import { makeMockClient } from './mockClient';

function ClientConsumer({ onClient }: { onClient: (client: any) => void }) {
  const client = useLDClient();
  onClient(client);
  return <span>rendered</span>;
}

it('returns the client from the nearest provider context', () => {
  const mockClient = makeMockClient();
  const contextValue: LDReactClientContextValue = {
    client: mockClient,
    initializedState: 'unknown',
  };

  let capturedClient: any;

  render(
    <LDReactContext.Provider value={contextValue}>
      <ClientConsumer
        onClient={(c) => {
          capturedClient = c;
        }}
      />
    </LDReactContext.Provider>,
  );

  expect(screen.getByText('rendered')).toBeTruthy();
  expect(capturedClient).toBe(mockClient);
});

it('returns the client from a custom react context', () => {
  const mockClient = makeMockClient();
  const customContext = React.createContext<LDReactClientContextValue>(null as any);
  const contextValue: LDReactClientContextValue = {
    client: mockClient,
    initializedState: 'unknown',
  };

  let capturedClient: any;

  function ClientConsumerCustom() {
    const client = useLDClient(customContext);
    capturedClient = client;
    return <span>custom</span>;
  }

  render(
    <customContext.Provider value={contextValue}>
      <ClientConsumerCustom />
    </customContext.Provider>,
  );

  expect(screen.getByText('custom')).toBeTruthy();
  expect(capturedClient).toBe(mockClient);
});
