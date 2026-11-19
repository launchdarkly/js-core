import type { FDv2DataManagerControl } from '@launchdarkly/js-client-sdk-common';

import { ElectronClient } from '../src/ElectronClient';
import type { ElectronOptions } from '../src/ElectronOptions';
import ElectronCrypto from '../src/platform/ElectronCrypto';
import ElectronEncoding from '../src/platform/ElectronEncoding';
import ElectronInfo from '../src/platform/ElectronInfo';
import { createMockLogger } from './testHelpers';

// These tests use the real shared FDv2 data manager, so network and override changes go
// through the real debounce and reconcile.
jest.mock('../src/platform/ElectronPlatform', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    crypto: new ElectronCrypto(),
    info: new ElectronInfo(),
    requests: {
      createEventSource: jest.fn(() => ({
        addEventListener: jest.fn(),
        close: jest.fn(),
      })),
      fetch: jest.fn(() => new Promise(() => {})),
      getEventSourceCapabilities: () => ({ readTimeout: true, headers: true, customMethod: true }),
    },
    encoding: new ElectronEncoding(),
    storage: {
      clear: jest.fn(async () => {}),
      get: jest.fn(async () => null),
      set: jest.fn(async () => {}),
    },
  })),
}));

const DEBOUNCE_WINDOW_MS = 1500;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

async function startClient(
  dataSystem: ElectronOptions['dataSystem'] = { automaticModeSwitching: true },
) {
  const client = new ElectronClient(
    'client-side-id',
    { kind: 'user', key: 'bob' },
    {
      useClientSideId: true,
      enableIPC: false,
      sendEvents: false,
      logger: createMockLogger(),
      dataSystem,
    },
  );
  client.start();
  await jest.advanceTimersByTimeAsync(10);
  // @ts-ignore dataManager is protected.
  const dataManager = client.dataManager as FDv2DataManagerControl;
  return { client, dataManager };
}

it('leaves network-driven offline when setConnectionMode requests the foreground mode', async () => {
  const { client, dataManager } = await startClient();
  expect(dataManager.getCurrentMode()).toBe('streaming');

  client.setNetworkAvailability(false);
  await jest.advanceTimersByTimeAsync(DEBOUNCE_WINDOW_MS);
  expect(dataManager.getCurrentMode()).toBe('offline');

  await client.setConnectionMode('streaming');
  await jest.advanceTimersByTimeAsync(DEBOUNCE_WINDOW_MS);

  expect(client.getConnectionMode()).toBe('streaming');
  expect(dataManager.getCurrentMode()).toBe('streaming');

  await client.close();
});

it('applies an override when the app repeats it within the debounce window', async () => {
  const { client, dataManager } = await startClient();

  await client.setConnectionMode('polling');
  // Each repeat comes before the 1 second debounce window closes.
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await jest.advanceTimersByTimeAsync(900);
    // eslint-disable-next-line no-await-in-loop
    await client.setConnectionMode('polling');
  }

  expect(dataManager.getCurrentMode()).toBe('polling');

  await client.close();
});

it('follows network changes again after the override is cleared', async () => {
  const { client, dataManager } = await startClient();

  await client.setConnectionMode('streaming');
  client.setNetworkAvailability(false);
  await jest.advanceTimersByTimeAsync(DEBOUNCE_WINDOW_MS);
  expect(dataManager.getCurrentMode()).toBe('streaming');

  await client.setConnectionMode();
  await jest.advanceTimersByTimeAsync(DEBOUNCE_WINDOW_MS);

  expect(dataManager.getCurrentMode()).toBe('offline');
  expect(client.getConnectionMode()).toBe('offline');

  await client.close();
});

it('turns event sending off when a cleared override returns to a configured offline mode', async () => {
  const { client, dataManager } = await startClient({
    automaticModeSwitching: { type: 'manual', initialConnectionMode: 'offline' },
  });
  const setEventSendingEnabled = jest.spyOn(client as any, 'setEventSendingEnabled');

  await client.setConnectionMode('streaming');
  expect(setEventSendingEnabled).toHaveBeenLastCalledWith(true, false);

  await client.setConnectionMode();
  await jest.advanceTimersByTimeAsync(DEBOUNCE_WINDOW_MS);

  expect(dataManager.getCurrentMode()).toBe('offline');
  expect(setEventSendingEnabled).toHaveBeenLastCalledWith(false, false);

  await client.close();
});
