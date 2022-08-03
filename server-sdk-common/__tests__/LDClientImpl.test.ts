import { LDClientImpl } from '../src';
import basicPlatform from './evaluation/mocks/platform';

it('fires ready event in offline mode', (done) => {
  const _client = new LDClientImpl(
    'sdk-key',
    basicPlatform,
    { offline: true },
    (_err) => { },
    (_err) => { },
    () => {
      done();
    },
    (_key) => { });
});

it('fires the failed event if initialization fails', (done) => {
  const _client = new LDClientImpl(
    'sdk-key',
    basicPlatform,
    {
      updateProcessor: {
        start: (fn: (err: any) => void) => {
          setTimeout(() => {
            fn(new Error("BAD THINGS"));
          }, 0);
        },
        stop: () => {},
        close: () => {}
      },
    },
    (_err) => { },
    (_err) => {
      done()
    },
    () => { },
    (_key) => { });
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
    (_key) => { });
});