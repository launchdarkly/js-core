import React from 'react';

import type { LDServerSession } from '../../src/server/LDClient';
import { LDIsomorphicProvider } from '../../src/server/LDIsomorphicProvider';

function makeMockSession(overrides?: Partial<LDServerSession>): LDServerSession {
  const bootstrapJson = { 'my-flag': true, $flagsState: {}, $valid: true };

  return {
    initialized: jest.fn(() => true),
    getContext: jest.fn(() => ({ kind: 'user', key: 'test-user' })),
    boolVariation: jest.fn(),
    numberVariation: jest.fn(),
    stringVariation: jest.fn(),
    jsonVariation: jest.fn(),
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
        toJSON: jest.fn(() => bootstrapJson),
      }),
    ),
    ...overrides,
  } as unknown as LDServerSession;
}

it('calls allFlagsState with clientSideOnly and passes toJSON as bootstrap', async () => {
  const session = makeMockSession();

  const result = await LDIsomorphicProvider({
    session,
    clientSideId: 'client-id-123',
    children: React.createElement('div'),
  });

  expect(session.allFlagsState).toHaveBeenCalledWith({ clientSideOnly: true });

  // The async component returns a React element whose props contain the bootstrap data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = result as any;
  expect(element.props.bootstrap).toEqual({
    'my-flag': true,
    $flagsState: {},
    $valid: true,
  });
});

it('passes session context to the client provider', async () => {
  const context = { kind: 'user' as const, key: 'ctx-abc' };
  const session = makeMockSession({
    getContext: jest.fn(() => context),
  });

  const result = await LDIsomorphicProvider({
    session,
    clientSideId: 'client-id-123',
    children: React.createElement('div'),
  });

  expect(session.getContext).toHaveBeenCalled();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = result as any;
  expect(element.props.context).toEqual(context);
});

it('forwards clientSideId to the client provider', async () => {
  const session = makeMockSession();

  const result = await LDIsomorphicProvider({
    session,
    clientSideId: 'my-client-side-id',
    children: React.createElement('div'),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = result as any;
  expect(element.props.clientSideId).toBe('my-client-side-id');
});

it('forwards options to the client provider', async () => {
  const session = makeMockSession();
  const options = { deferInitialization: true };

  const result = await LDIsomorphicProvider({
    session,
    clientSideId: 'client-id-123',
    // @ts-ignore — minimal options mock
    options,
    children: React.createElement('div'),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = result as any;
  expect(element.props.options).toEqual(options);
});

it('passes children to the client provider', async () => {
  const session = makeMockSession();
  const child = React.createElement('span', null, 'hello');

  const result = await LDIsomorphicProvider({
    session,
    clientSideId: 'client-id-123',
    children: child,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = result as any;
  expect(element.props.children).toEqual(child);
});
