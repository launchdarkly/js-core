/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';

import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDServerSession } from '../../src/server/LDClient';
import { LDIsomorphicProvider } from '../../src/server/LDIsomorphicProvider';

// Mock LDBootstrapClientProvider so we can assert it receives correct props
jest.mock('../../src/client/provider/LDBootstrapClientProvider', () => ({
  LDBootstrapClientProvider: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="bootstrap-provider">{children}</div>
  )),
}));

const { LDBootstrapClientProvider } = jest.requireMock(
  '../../src/client/provider/LDBootstrapClientProvider',
);

const context: LDContext = { kind: 'user', key: 'test-user' };

const bootstrapData = { $flagsState: { 'my-flag': { variation: 0 } }, $valid: true };

function makeSession(overrides?: Partial<LDServerSession>): LDServerSession {
  return {
    initialized: () => true,
    getContext: () => context,
    boolVariation: jest.fn((_key, def) => Promise.resolve(def)),
    numberVariation: jest.fn((_key, def) => Promise.resolve(def)),
    stringVariation: jest.fn((_key, def) => Promise.resolve(def)),
    jsonVariation: jest.fn((_key, def) => Promise.resolve(def)),
    boolVariationDetail: jest.fn(),
    numberVariationDetail: jest.fn(),
    stringVariationDetail: jest.fn(),
    jsonVariationDetail: jest.fn(),
    allFlagsState: jest.fn(() =>
      Promise.resolve({
        valid: true,
        getFlagValue: jest.fn(),
        getFlagReason: jest.fn(),
        allValues: jest.fn(() => ({})),
        toJSON: jest.fn(() => bootstrapData),
      }),
    ),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders children inside LDBootstrapClientProvider', async () => {
  const session = makeSession();
  const jsx = await LDIsomorphicProvider({
    session,
    clientSideId: 'test-id',
    children: <span>hello</span>,
  });

  render(jsx as React.ReactElement);

  expect(screen.getByTestId('bootstrap-provider')).toBeTruthy();
  expect(screen.getByText('hello')).toBeTruthy();
});

it('calls session.allFlagsState()', async () => {
  const session = makeSession();
  await LDIsomorphicProvider({ session, clientSideId: 'test-id', children: null });
  expect(session.allFlagsState).toHaveBeenCalledTimes(1);
});

it('passes clientSideId to LDBootstrapClientProvider', async () => {
  const session = makeSession();
  const jsx = await LDIsomorphicProvider({
    session,
    clientSideId: 'my-client-id',
    children: null,
  });
  render(jsx as React.ReactElement);

  const { calls } = (LDBootstrapClientProvider as jest.Mock).mock;
  expect(calls[0][0]).toMatchObject({ clientSideId: 'my-client-id' });
});

it('passes session context to LDBootstrapClientProvider', async () => {
  const session = makeSession();
  const jsx = await LDIsomorphicProvider({
    session,
    clientSideId: 'my-client-id',
    children: null,
  });
  render(jsx as React.ReactElement);

  const { calls } = (LDBootstrapClientProvider as jest.Mock).mock;
  expect(calls[0][0]).toMatchObject({ context });
});

it('passes bootstrap from flagsState.toJSON() to LDBootstrapClientProvider', async () => {
  const session = makeSession();
  const jsx = await LDIsomorphicProvider({
    session,
    clientSideId: 'my-client-id',
    children: null,
  });
  render(jsx as React.ReactElement);

  const { calls } = (LDBootstrapClientProvider as jest.Mock).mock;
  expect(calls[0][0]).toMatchObject({ bootstrap: bootstrapData });
});
