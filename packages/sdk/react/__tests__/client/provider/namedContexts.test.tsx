/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';
import React, { useContext } from 'react';

import { useLDClient } from '../../../src/client/hooks/useLDClient';
import { useBoolVariation } from '../../../src/client/hooks/useVariation';
import { LDReactClient, LDReactClientContextValue } from '../../../src/client/LDClient';
import { initLDReactContext, LDReactContext } from '../../../src/client/provider/LDReactContext';
import { createLDReactProviderWithClient } from '../../../src/client/provider/LDReactProvider';
import { makeMockClient } from './mockClient';

it('hook using a named context reads from the named client, not the global one', () => {
  const NamedContext = initLDReactContext();

  const globalClient = makeMockClient();
  const namedClient = makeMockClient();

  (globalClient.boolVariation as jest.Mock).mockReturnValue(true);
  (namedClient.boolVariation as jest.Mock).mockReturnValue(false);

  const GlobalProvider = createLDReactProviderWithClient(globalClient);
  const NamedProvider = createLDReactProviderWithClient(namedClient, NamedContext);

  let valueFromNamed: boolean = true;

  function Consumer() {
    valueFromNamed = useBoolVariation('my-flag', false, NamedContext);
    return null;
  }

  render(
    <GlobalProvider>
      <NamedProvider>
        <Consumer />
      </NamedProvider>
    </GlobalProvider>,
  );

  expect(namedClient.boolVariation).toHaveBeenCalledWith('my-flag', false);
  expect(globalClient.boolVariation).not.toHaveBeenCalled();
  expect(valueFromNamed).toBe(false);
});

it('hook with no context arg reads from the global LDReactContext provider', () => {
  const NamedContext = initLDReactContext();

  const globalClient = makeMockClient();
  const namedClient = makeMockClient();

  (globalClient.boolVariation as jest.Mock).mockReturnValue(true);
  (namedClient.boolVariation as jest.Mock).mockReturnValue(false);

  const GlobalProvider = createLDReactProviderWithClient(globalClient);
  const NamedProvider = createLDReactProviderWithClient(namedClient, NamedContext);

  let valueFromGlobal: boolean = false;

  function Consumer() {
    valueFromGlobal = useBoolVariation('my-flag', false);
    return null;
  }

  render(
    <GlobalProvider>
      <NamedProvider>
        <Consumer />
      </NamedProvider>
    </GlobalProvider>,
  );

  expect(globalClient.boolVariation).toHaveBeenCalledWith('my-flag', false);
  expect(namedClient.boolVariation).not.toHaveBeenCalled();
  expect(valueFromGlobal).toBe(true);
});

it('a named-context provider does not populate the global LDReactContext', () => {
  const NamedContext = initLDReactContext();

  const namedClient = makeMockClient();
  const NamedProvider = createLDReactProviderWithClient(namedClient, NamedContext);

  let globalContextValue: LDReactClientContextValue | undefined;

  function Consumer() {
    globalContextValue = useContext(LDReactContext);
    return null;
  }

  // Only a named provider — no global provider wrapping it
  render(
    <NamedProvider>
      <Consumer />
    </NamedProvider>,
  );

  // The global LDReactContext should be null (its default), not the named client
  expect(globalContextValue).toBeNull();
});

it('useBoolVariation and useLDClient return data from the named context when supplied', () => {
  const NamedContext = initLDReactContext();

  const globalClient = makeMockClient();
  const namedClient = makeMockClient();

  (namedClient.boolVariation as jest.Mock).mockReturnValue(true);
  (globalClient.boolVariation as jest.Mock).mockReturnValue(false);

  const GlobalProvider = createLDReactProviderWithClient(globalClient);
  const NamedProvider = createLDReactProviderWithClient(namedClient, NamedContext);

  let namedFlagValue: boolean = false;
  let globalFlagValue: boolean = true;
  let clientFromNamed: LDReactClient | undefined;
  let clientFromGlobal: LDReactClient | undefined;

  function Consumer() {
    namedFlagValue = useBoolVariation('my-flag', false, NamedContext);
    globalFlagValue = useBoolVariation('my-flag', false);
    clientFromNamed = useLDClient(NamedContext);
    clientFromGlobal = useLDClient();
    return null;
  }

  render(
    <GlobalProvider>
      <NamedProvider>
        <Consumer />
      </NamedProvider>
    </GlobalProvider>,
  );

  expect(namedClient.boolVariation).toHaveBeenCalledWith('my-flag', false);
  expect(globalClient.boolVariation).toHaveBeenCalledWith('my-flag', false);
  expect(namedFlagValue).toBe(true);
  expect(globalFlagValue).toBe(false);
  expect(clientFromNamed).toBe(namedClient);
  expect(clientFromGlobal).toBe(globalClient);
});
