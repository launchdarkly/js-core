/* eslint-disable @typescript-eslint/no-unused-vars */
import { LDClientImpl } from '../src';
import basicPlatform from './evaluation/mocks/platform';
import TestLogger from './Logger';
import makeCallbacks from './makeCallbacks';

it('fires ready event in offline mode', (done) => {
  const client = new LDClientImpl(
    'sdk-key',
    basicPlatform,
    { offline: true },
    { ...makeCallbacks(false), onReady: () => done() }
  );
  client.close();
});

it('fires the failed event if initialization fails', (done) => {
  const client = new LDClientImpl(
    'sdk-key',
    basicPlatform,
    {
      updateProcessor: {
        start: (fn: (err: any) => void) => {
          setTimeout(() => {
            fn(new Error('BAD THINGS'));
          }, 0);
        },
        stop: () => {},
        close: () => {},
      },
    },
    { ...makeCallbacks(false), onFailed: () => done() }
  );

  client.close();
});

it('isOffline returns true in offline mode', (done) => {
  const client = new LDClientImpl(
    'sdk-key',
    basicPlatform,
    { offline: true },
    {
      ...makeCallbacks(false),
      onReady: () => {
        expect(client.isOffline()).toEqual(true);
        done();
      },
    }
  );

  client.close();
});

describe('when waiting for initialization', () => {
  let client: LDClientImpl;
  let resolve: Function;

  beforeEach(() => {
    client = new LDClientImpl(
      'sdk-key',
      basicPlatform,
      {
        updateProcessor: {
          start: (fn: (err?: any) => void) => {
            resolve = fn;
          },
          stop: () => {},
          close: () => {},
        },
        sendEvents: false,
        logger: new TestLogger(),
      },
      makeCallbacks(false)
    );
  });

  afterEach(() => {
    client.close();
  });

  it('resolves when ready', async () => {
    resolve();
    await client.waitForInitialization();
  });

  it('resolves immediately if the client is already ready', async () => {
    resolve();
    await client.waitForInitialization();
    await client.waitForInitialization();
  });

  it('creates only one Promise', async () => {
    const p1 = client.waitForInitialization();
    const p2 = client.waitForInitialization();
    resolve();
    expect(p2).toBe(p1);
  });
});

it('does not crash when closing an offline client', () => {
  const client = new LDClientImpl(
    'sdk-key',
    basicPlatform,
    { offline: true },
    makeCallbacks(false)
  );

  expect(() => client.close()).not.toThrow();
  client.close();
});

it('the wait for initialization promise is rejected if initialization fails', (done) => {
  const client = new LDClientImpl(
    'sdk-key',
    basicPlatform,
    {
      updateProcessor: {
        start: (fn: (err: any) => void) => {
          setTimeout(() => {
            fn(new Error('BAD THINGS'));
          }, 0);
        },
        stop: () => {},
        close: () => {},
      },
      sendEvents: false,
    },
    makeCallbacks(false)
  );

  client.waitForInitialization().catch(() => done());
  client.close();
});
