import { LDClientImpl } from '../src';
import { createBasicPlatform } from './createBasicPlatform';
import TestLogger from './Logger';
import makeCallbacks from './makeCallbacks';

it('flushes events successfully and executes the callback', async () => {
  const platform = createBasicPlatform();
  platform.requests.fetch.mockImplementation(() =>
    Promise.resolve({ status: 200, headers: new Headers() }),
  );

  const client = new LDClientImpl(
    'sdk-key-events',
    platform,
    {
      logger: new TestLogger(),
      stream: false,
    },
    makeCallbacks(false),
  );

  client.identify({ key: 'user' });
  client.variation('dev-test-flag', { key: 'user' }, false);

  const flushCallback = jest.fn();

  await client.flush(flushCallback);

  expect(platform.requests.fetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/bulk',
    expect.objectContaining({
      method: 'POST',
      body: expect.any(String),
    }),
  );
  expect(flushCallback).toHaveBeenCalledWith(null, true);
  expect(flushCallback).toHaveBeenCalledTimes(1);
});

it('flushes events successfully', async () => {
  const platform = createBasicPlatform();
  platform.requests.fetch.mockImplementation(() =>
    Promise.resolve({ status: 200, headers: new Headers() }),
  );

  const client = new LDClientImpl(
    'sdk-key-events',
    platform,
    {
      logger: new TestLogger(),
      stream: false,
    },
    makeCallbacks(false),
  );

  client.identify({ key: 'user' });
  client.variation('dev-test-flag', { key: 'user' }, false);

  await client.flush();

  expect(platform.requests.fetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/bulk',
    expect.objectContaining({
      method: 'POST',
      body: expect.any(String),
    }),
  );
});

it('calls error callback once when flush fails with http status code', async () => {
  const platform = createBasicPlatform();
  platform.requests.fetch.mockImplementation(() =>
    Promise.resolve({ status: 401, headers: new Headers() }),
  );

  const flushCallback = jest.fn();
  const client = new LDClientImpl(
    'sdk-key-events',
    platform,
    {
      logger: new TestLogger(),
      stream: false,
    },
    makeCallbacks(false),
  );

  client.identify({ key: 'user' });
  client.variation('dev-test-flag', { key: 'user' }, false);

  await client.flush(flushCallback);

  expect(flushCallback).toHaveBeenCalledWith(expect.any(Error), false);
  expect(flushCallback).toHaveBeenCalledTimes(1);
});

it('calls error callback once when flush fails with exception', async () => {
  const platform = createBasicPlatform();
  platform.requests.fetch.mockImplementation(() => Promise.reject(new Error('test error')));

  const flushCallback = jest.fn();
  const client = new LDClientImpl(
    'sdk-key-events',
    platform,
    {
      logger: new TestLogger(),
      stream: false,
    },
    makeCallbacks(false),
  );

  client.identify({ key: 'user' });
  client.variation('dev-test-flag', { key: 'user' }, false);

  await client.flush(flushCallback);

  expect(flushCallback).toHaveBeenCalledWith(expect.any(Error), false);
  expect(flushCallback).toHaveBeenCalledTimes(1);
});
