import { LDLogger } from '@launchdarkly/node-server-sdk';

import RedisCore from '../src/RedisCore';
import { makeState } from './testUtils';

it.each([false, true])('settles getAll after a Redis error with logger=%s', (withLogger) => {
  const error = new Error('WRONGPASS invalid username-password pair');
  const hgetall = jest.fn((_key: string, cb: (err: Error) => void) => cb(error));
  const state = makeState({ getClient: () => ({ hgetall }) });
  const logger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  // @ts-ignore Partial state mock for testing.
  const core = new RedisCore(state, withLogger ? logger : undefined);
  const callback = jest.fn();

  core.getAll({ namespace: 'features', deserialize: JSON.parse }, callback);

  expect(hgetall).toHaveBeenCalledTimes(1);
  expect(hgetall).toHaveBeenCalledWith('features', expect.any(Function));
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(undefined);
  expect(logger.error).toHaveBeenCalledTimes(withLogger ? 1 : 0);
  expect((logger.error as jest.Mock).mock.calls).toEqual(
    withLogger ? [[`Error fetching 'features' from Redis ${error}`]] : [],
  );
});
