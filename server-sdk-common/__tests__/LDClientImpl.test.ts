/* eslint-disable @typescript-eslint/no-unused-vars */
import { LDClientImpl } from '../src';
import basicPlatform from './evaluation/mocks/platform';
import TestLogger from './Logger';

it('fires ready event in offline mode', (done) => {
  const client = new LDClientImpl(
    'sdk-key',
    basicPlatform,
    { offline: true },
    (_err) => { },
    (_err) => { },
    () => {
      done();
    },
    (_key) => { },
    () => false,
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
        stop: () => { },
        close: () => { },
      },
    },
    (_err) => { },
    (_err) => {
      done();
    },
    () => { },
    (_key) => { },
    () => false,
  );

  client.close();
});

it('isOffline returns true in offline mode', (done) => {
  const client = new LDClientImpl(
    'sdk-key',
    basicPlatform,
    { offline: true },
    (_err) => { },
    (_err) => { },
    () => {
      expect(client.isOffline()).toEqual(true);
      done();
    },
    (_key) => { },
    () => false,
  );

  client.close();
});

describe('when waiting for initialization', () => {
  let client: LDClientImpl;

  beforeEach(() => {
    client = new LDClientImpl(
      'sdk-key',
      basicPlatform,
      {
        updateProcessor: {
          start: (fn: (err?: any) => void) => {
            setTimeout(() => {
              fn();
            }, 0);
          },
          stop: () => { },
          close: () => { },
        },
        sendEvents: false,
        logger: new TestLogger(),
      },
      (_err) => { },
      (_err) => { },
      () => { },
      (_key) => { },
      () => false,
    );
  });

  afterEach(() => {
    client.close();
  });

  it('resolves when ready', async () => {
    await client.waitForInitialization();
  });

  it('resolves immediately if the client is already ready', async () => {
    await client.waitForInitialization();
    await client.waitForInitialization();
  });

  it('creates only one Promise', async () => {
    const p1 = client.waitForInitialization();
    const p2 = client.waitForInitialization();
    expect(p2).toBe(p1);
  });
});

it('does not crash when closing an offline client', () => {
  const client = new LDClientImpl(
    'sdk-key',
    basicPlatform,
    { offline: true },
    (_err) => { },
    (_err) => { },
    () => {
    },
    (_key) => { },
    () => false,
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
        stop: () => { },
        close: () => { },
      },
    },
    (_err) => { },
    (_err) => { },
    () => { },
    (_key) => { },
    () => false,
  );

  client.waitForInitialization().catch(() => done());
  client.close();
});
