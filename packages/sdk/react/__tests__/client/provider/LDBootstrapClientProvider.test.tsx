/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import React from 'react';

import { LDContext } from '@launchdarkly/js-client-sdk';

import { createClient } from '../../../src/client/LDReactClient';
import { LDBootstrapClientProvider } from '../../../src/client/provider/LDBootstrapClientProvider';
import { createLDReactProviderWithClient } from '../../../src/client/provider/LDReactProvider';
import { makeMockClient } from './mockClient';

jest.mock('../../../src/client/LDReactClient', () => ({
  createClient: jest.fn(),
}));

jest.mock('../../../src/client/provider/LDReactProvider', () => ({
  createLDReactProviderWithClient: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCreateProviderWithClient = createLDReactProviderWithClient as jest.MockedFunction<
  typeof createLDReactProviderWithClient
>;

const context: LDContext = { kind: 'user', key: 'test-user' };
const bootstrap = { $flagsState: { 'my-flag': { variation: 0 } }, $valid: true };

beforeEach(() => {
  jest.clearAllMocks();
});

it('creates a client with the given clientSideId and context', () => {
  const client = makeMockClient();
  mockCreateClient.mockReturnValue(client);
  mockCreateProviderWithClient.mockReturnValue(({ children }) => <>{children}</>);

  render(
    <LDBootstrapClientProvider clientSideId="test-id" context={context} bootstrap={bootstrap}>
      <span>child</span>
    </LDBootstrapClientProvider>,
  );

  expect(mockCreateClient).toHaveBeenCalledWith('test-id', context);
});

it('calls client.start() with the bootstrap data', () => {
  const client = makeMockClient();
  mockCreateClient.mockReturnValue(client);
  mockCreateProviderWithClient.mockReturnValue(({ children }) => <>{children}</>);

  render(
    <LDBootstrapClientProvider clientSideId="test-id" context={context} bootstrap={bootstrap}>
      <span />
    </LDBootstrapClientProvider>,
  );

  expect(client.start).toHaveBeenCalledWith({ bootstrap });
});

it('creates the client and provider exactly once across re-renders', () => {
  const client = makeMockClient();
  mockCreateClient.mockReturnValue(client);
  mockCreateProviderWithClient.mockReturnValue(({ children }) => <>{children}</>);

  const { rerender } = render(
    <LDBootstrapClientProvider clientSideId="test-id" context={context} bootstrap={bootstrap}>
      <span />
    </LDBootstrapClientProvider>,
  );

  rerender(
    <LDBootstrapClientProvider clientSideId="test-id" context={context} bootstrap={bootstrap}>
      <span />
    </LDBootstrapClientProvider>,
  );

  expect(mockCreateClient).toHaveBeenCalledTimes(1);
  expect(mockCreateProviderWithClient).toHaveBeenCalledTimes(1);
});

it('renders children inside the provider', () => {
  const client = makeMockClient();
  mockCreateClient.mockReturnValue(client);
  mockCreateProviderWithClient.mockReturnValue(({ children }) => (
    <div data-testid="ld-provider">{children}</div>
  ));

  render(
    <LDBootstrapClientProvider clientSideId="test-id" context={context} bootstrap={bootstrap}>
      <span>hello world</span>
    </LDBootstrapClientProvider>,
  );

  expect(screen.getByText('hello world')).toBeTruthy();
});

it('passes the client to createLDReactProviderWithClient', () => {
  const client = makeMockClient();
  mockCreateClient.mockReturnValue(client);
  mockCreateProviderWithClient.mockReturnValue(({ children }) => <>{children}</>);

  render(
    <LDBootstrapClientProvider clientSideId="test-id" context={context} bootstrap={bootstrap}>
      <span />
    </LDBootstrapClientProvider>,
  );

  expect(mockCreateProviderWithClient).toHaveBeenCalledWith(client);
});
