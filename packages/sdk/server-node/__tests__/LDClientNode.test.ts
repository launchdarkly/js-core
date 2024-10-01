import { LDContext, LDLogger } from '@launchdarkly/js-server-sdk-common';

import { init } from '../src';

let logger: LDLogger;

beforeEach(() => {
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});

it('fires ready event in offline mode', (done) => {
  const client = init('sdk_key', { offline: true });
  client.on('ready', () => {
    client.close();
    done();
  });
});

it('fires the failed event if initialization fails', async () => {
  jest.useFakeTimers();

  const failedHandler = jest.fn().mockName('failedHandler');
  const client = init('sdk_key', {
    sendEvents: false,
    logger,
    updateProcessor: (clientContext, dataSourceUpdates, initSuccessHandler, errorHandler) => ({
      start: () => {
        setTimeout(() => errorHandler?.(new Error('Something unexpected happened')), 0);
      },
      close: jest.fn(),
    }),
  });
  client.on('failed', failedHandler);
  jest.runAllTimers();

  expect(failedHandler).toBeCalledWith(new Error('Something unexpected happened'));
});

// These tests are done in the node implementation because common doesn't have a crypto
// implementation.
describe('when using secure mode hash', () => {
  it('correctly computes hash for a known message and secret', () => {
    const client = init('secret', { offline: true });
    const hash = client.secureModeHash({ key: 'Message' });
    expect(hash).toEqual('aa747c502a898200f9e4fa21bac68136f886a0e27aec70ba06daf2e2a5cb5597');
  });

  it.each<[LDContext, string]>([
    [{ key: 'Message' }, 'aa747c502a898200f9e4fa21bac68136f886a0e27aec70ba06daf2e2a5cb5597'],
    [
      { kind: 'user', key: 'Message' },
      'aa747c502a898200f9e4fa21bac68136f886a0e27aec70ba06daf2e2a5cb5597',
    ],
    [
      { kind: 'org', key: 'orgtest' },
      '40bc9b2e66a842e269ab98dad813e4e15203bbbfd91e8c96b92f3ae6f3f5e223',
    ],
    [
      { kind: 'multi', user: { key: 'user:test' }, org: { key: 'org:test' } },
      '607cc91526c615823e320dabca7967ce544fbe83bcb2b7287163f2d1c7aa210f',
    ],
  ])('it uses the canonical key %p', (context, expectedHash) => {
    const client = init('secret', { offline: true });
    const hash = client.secureModeHash(context);

    expect(hash).toEqual(expectedHash);
    client.close();
  });
});
