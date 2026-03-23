/**
 * @jest-environment jsdom
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import React, { useContext } from 'react';

import { LDContextStrict } from '@launchdarkly/js-client-sdk';

import { LDReactClientContextValue } from '../../../src/client/LDClient';
import { createClient } from '../../../src/client/LDReactClient';
import { initLDReactContext, LDReactContext } from '../../../src/client/provider/LDReactContext';
import {
  createLDReactProvider,
  createLDReactProviderWithClient,
} from '../../../src/client/provider/LDReactProvider';
import { makeMockClient } from '../mockClient';

jest.mock('../../../src/client/LDReactClient', () => ({
  createClient: jest.fn(),
}));

// ─── createLDReactProviderWithClient ────────────────────────────────────────
it('renders children', () => {
  const client = makeMockClient();
  const Provider = createLDReactProviderWithClient(client);

  render(
    <Provider>
      <span>hello</span>
    </Provider>,
  );

  expect(screen.getByText('hello')).toBeTruthy();
});

it('does not call client.start() on mount', () => {
  const client = makeMockClient();
  const Provider = createLDReactProviderWithClient(client);

  render(
    <Provider>
      <span />
    </Provider>,
  );

  expect(client.start).not.toHaveBeenCalled();
});

it('calls client.onInitializationStatusChange() on mount', () => {
  const client = makeMockClient();
  const Provider = createLDReactProviderWithClient(client);

  render(
    <Provider>
      <span />
    </Provider>,
  );

  expect(client.onInitializationStatusChange).toHaveBeenCalledTimes(1);
});

it('updates initializedState and context when onInitializationStatusChange fires', async () => {
  const initialCtx: LDContextStrict = { kind: 'user', key: 'u1' };
  const client = makeMockClient();
  (client.getContext as jest.Mock).mockReturnValue(initialCtx);

  const contextValues: LDReactClientContextValue[] = [];

  function Consumer() {
    const value = useContext(LDReactContext);
    contextValues.push(value);
    return null;
  }

  const Provider = createLDReactProviderWithClient(client);

  render(
    <Provider>
      <Consumer />
    </Provider>,
  );

  expect(contextValues[contextValues.length - 1]?.initializedState).toBe('unknown');

  await act(async () => {
    client.fireInitStatusChange('complete');
  });

  await waitFor(() => {
    expect(contextValues[contextValues.length - 1]?.initializedState).toBe('complete');
  });
  expect(contextValues[contextValues.length - 1]?.context).toEqual(initialCtx);
});

it('still subscribes to onContextChange', async () => {
  const client = makeMockClient();
  const newCtx: LDContextStrict = { kind: 'user', key: 'user-2', name: 'Jamie' };
  const contextValues: LDReactClientContextValue[] = [];

  function Consumer() {
    const value = useContext(LDReactContext);
    contextValues.push(value);
    return null;
  }

  const Provider = createLDReactProviderWithClient(client);

  render(
    <Provider>
      <Consumer />
    </Provider>,
  );

  await act(async () => {
    client.fireContextChange(newCtx);
  });

  await waitFor(() => {
    expect(contextValues[contextValues.length - 1]?.context).toEqual(newCtx);
  });
});

it('does not call setState after unmount (cleanup)', async () => {
  const client = makeMockClient();
  const Provider = createLDReactProviderWithClient(client);

  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  const { unmount } = render(
    <Provider>
      <span />
    </Provider>,
  );

  unmount();

  await act(async () => {
    client.fireInitStatusChange('complete');
  });

  consoleSpy.mockRestore();
  expect(client.onInitializationStatusChange).toHaveBeenCalledTimes(1);
  expect(client.start).not.toHaveBeenCalled();
});

it('includes error in initial state when client was already failed before mount', () => {
  const preFailedError = new Error('pre-failed init');
  const client = makeMockClient({ preFailedError });
  const contextValues: LDReactClientContextValue[] = [];

  function Consumer() {
    const value = useContext(LDReactContext);
    contextValues.push(value);
    return null;
  }

  const Provider = createLDReactProviderWithClient(client);

  render(
    <Provider>
      <Consumer />
    </Provider>,
  );

  const firstRender = contextValues[0];
  expect(firstRender?.initializedState).toBe('failed');
  expect(firstRender?.error).toBe(preFailedError);
});

// ─── createLDReactProvider (convenience factory) ─────────────────────────────

describe('createLDReactProvider (convenience factory)', () => {
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    (createClient as jest.Mock).mockReturnValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders children', () => {
    const Provider = createLDReactProvider('sdk-key', { kind: 'user', key: 'u1' });

    render(
      <Provider>
        <span>hello</span>
      </Provider>,
    );

    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('calls client.start() by default (deferInitialization not set)', () => {
    createLDReactProvider('sdk-key', { kind: 'user', key: 'u1' });

    expect(mockClient.start).toHaveBeenCalledTimes(1);
  });

  it('calls client.start() when deferInitialization is false', () => {
    createLDReactProvider('sdk-key', { kind: 'user', key: 'u1' }, { deferInitialization: false });

    expect(mockClient.start).toHaveBeenCalledTimes(1);
  });

  it('does not call client.start() when deferInitialization is true', () => {
    createLDReactProvider('sdk-key', { kind: 'user', key: 'u1' }, { deferInitialization: true });

    expect(mockClient.start).not.toHaveBeenCalled();
  });

  it('passes startOptions to client.start()', () => {
    const startOptions = { timeout: 5 };
    createLDReactProvider('sdk-key', { kind: 'user', key: 'u1' }, { startOptions });

    expect(mockClient.start).toHaveBeenCalledWith(startOptions);
  });

  it('merges bootstrap into startOptions when bootstrap is provided', () => {
    const bootstrapData = { $flagsState: { flag: { variation: 0 } }, $valid: true };
    createLDReactProvider('sdk-key', { kind: 'user', key: 'u1' }, { bootstrap: bootstrapData });

    expect(mockClient.start).toHaveBeenCalledWith({ bootstrap: bootstrapData });
  });

  it('merges bootstrap with existing startOptions', () => {
    const bootstrapData = { $flagsState: { flag: { variation: 0 } }, $valid: true };
    const startOptions = { timeout: 5 };
    createLDReactProvider(
      'sdk-key',
      { kind: 'user', key: 'u1' },
      { startOptions, bootstrap: bootstrapData },
    );

    expect(mockClient.start).toHaveBeenCalledWith({ timeout: 5, bootstrap: bootstrapData });
  });

  it('does not merge bootstrap into startOptions when bootstrap is not provided', () => {
    createLDReactProvider('sdk-key', { kind: 'user', key: 'u1' });

    expect(mockClient.start).toHaveBeenCalledWith(undefined);
  });

  it('uses provided reactContext option', () => {
    const CustomContext = initLDReactContext();
    const contextValues: LDReactClientContextValue[] = [];

    function Consumer() {
      const value = useContext(CustomContext);
      contextValues.push(value);
      return null;
    }

    const Provider = createLDReactProvider(
      'sdk-key',
      { kind: 'user', key: 'u1' },
      { reactContext: CustomContext },
    );

    render(
      <Provider>
        <Consumer />
      </Provider>,
    );

    expect(contextValues[contextValues.length - 1]?.client).toBe(mockClient);
  });

  it('passes ldOptions as client options to createClient', () => {
    const clientOptions = { streaming: true };
    createLDReactProvider('sdk-key', { kind: 'user', key: 'u1' }, { ldOptions: clientOptions });

    expect(createClient).toHaveBeenCalledWith(
      'sdk-key',
      { kind: 'user', key: 'u1' },
      clientOptions,
    );
  });

  it('does not forward deferInitialization/startOptions/reactContext to createClient', () => {
    const reactContext = initLDReactContext();
    const startOptions = { timeout: 3 };
    createLDReactProvider(
      'sdk-key',
      { kind: 'user', key: 'u1' },
      { deferInitialization: false, startOptions, reactContext },
    );

    // No ldOptions provided, so createClient receives undefined for client options.
    const clientOptions = (createClient as jest.Mock).mock.calls[0][2];
    expect(clientOptions).toBeUndefined();
  });
});
