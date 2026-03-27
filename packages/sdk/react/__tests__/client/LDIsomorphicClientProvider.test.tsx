import React from 'react';

import { createNoopClient } from '../../src/client/createNoopClient';
import { LDIsomorphicClientProvider } from '../../src/client/provider/LDIsomorphicClientProvider';
import {
  createLDReactProvider,
  createLDReactProviderWithClient,
} from '../../src/client/provider/LDReactProvider';

const mockNoopClient = { noop: true };
const MockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  React.createElement('div', { 'data-testid': 'mock-provider' }, children);

jest.mock('../../src/client/createNoopClient', () => ({
  createNoopClient: jest.fn(() => mockNoopClient),
}));

jest.mock('../../src/client/provider/LDReactProvider', () => ({
  createLDReactProvider: jest.fn(() => MockProvider),
  createLDReactProviderWithClient: jest.fn(() => MockProvider),
}));

// Mock useRef to work outside React's render context.
let refStore: { current: unknown } = { current: null };

const defaultProps = {
  clientSideId: 'client-id-123',
  context: { kind: 'user' as const, key: 'user-1' },
  bootstrap: { 'my-flag': true, $flagsState: {}, $valid: true },
  children: React.createElement('span', null, 'child'),
};

beforeEach(() => {
  jest.clearAllMocks();
  refStore = { current: null };
  jest.spyOn(React, 'useRef').mockImplementation(() => refStore);
});

// The test environment is node (no window), so SSR path is always taken.
it('creates a noop client with bootstrap on the server', () => {
  LDIsomorphicClientProvider(defaultProps);

  expect(createNoopClient).toHaveBeenCalledWith(defaultProps.bootstrap);
  expect(createLDReactProviderWithClient).toHaveBeenCalledWith(mockNoopClient);
  expect(createLDReactProvider).not.toHaveBeenCalled();
});

it('does not re-initialize the provider on subsequent renders', () => {
  LDIsomorphicClientProvider(defaultProps);
  expect(createLDReactProviderWithClient).toHaveBeenCalledTimes(1);

  // Second render — provider ref is already populated, so factories should not be called again.
  jest.clearAllMocks();
  LDIsomorphicClientProvider(defaultProps);
  expect(createNoopClient).not.toHaveBeenCalled();
  expect(createLDReactProviderWithClient).not.toHaveBeenCalled();
});

describe('given a browser environment (window defined)', () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
    // @ts-ignore — simulate browser
    globalThis.window = {};
  });

  afterEach(() => {
    // @ts-ignore
    globalThis.window = originalWindow;
  });

  it('creates a real provider with bootstrap on the client', () => {
    LDIsomorphicClientProvider(defaultProps);

    expect(createLDReactProvider).toHaveBeenCalledWith(
      defaultProps.clientSideId,
      defaultProps.context,
      { bootstrap: defaultProps.bootstrap },
    );
    expect(createNoopClient).not.toHaveBeenCalled();
  });

  it('forwards options merged with bootstrap to createLDReactProvider', () => {
    const options = { deferInitialization: true };

    LDIsomorphicClientProvider({ ...defaultProps, options });

    expect(createLDReactProvider).toHaveBeenCalledWith(
      defaultProps.clientSideId,
      defaultProps.context,
      { deferInitialization: true, bootstrap: defaultProps.bootstrap },
    );
  });
});
