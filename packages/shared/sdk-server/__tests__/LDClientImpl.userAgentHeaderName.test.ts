import { LDClientImpl } from '../src';
import { createBasicPlatform } from './createBasicPlatform';
import TestLogger from './Logger';
import makeCallbacks from './makeCallbacks';

it('sends the user-agent value under the overridden header name on the events path', async () => {
  const platform = createBasicPlatform();
  platform.requests.fetch.mockImplementation(() =>
    Promise.resolve({ status: 200, headers: new Headers() }),
  );

  const client = new LDClientImpl(
    'sdk-key-user-agent-1',
    platform,
    { logger: new TestLogger(), stream: false },
    makeCallbacks(false),
    { userAgentHeaderName: 'x-launchdarkly-user-agent' },
  );

  client.identify({ key: 'user' });
  await client.flush();

  expect(platform.requests.fetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/bulk',
    expect.objectContaining({
      headers: expect.objectContaining({
        'x-launchdarkly-user-agent': expect.anything(),
      }),
    }),
  );
  expect(platform.requests.fetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/bulk',
    expect.objectContaining({
      headers: expect.not.objectContaining({
        'user-agent': expect.anything(),
      }),
    }),
  );

  client.close();
});

it('sends the user-agent value under the overridden header name on the polling path', async () => {
  const platform = createBasicPlatform();
  platform.requests.fetch.mockImplementation(() =>
    Promise.resolve({ status: 200, headers: new Headers(), body: '{}' }),
  );

  const client = new LDClientImpl(
    'sdk-key-user-agent-2',
    platform,
    { logger: new TestLogger(), stream: false },
    makeCallbacks(false),
    { userAgentHeaderName: 'x-launchdarkly-user-agent' },
  );

  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  expect(platform.requests.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/sdk/latest-all'),
    expect.objectContaining({
      headers: expect.objectContaining({
        'x-launchdarkly-user-agent': expect.anything(),
      }),
    }),
  );
  expect(platform.requests.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/sdk/latest-all'),
    expect.objectContaining({
      headers: expect.not.objectContaining({
        'user-agent': expect.anything(),
      }),
    }),
  );

  client.close();
});

it('uses the default user-agent header name when no override is supplied', async () => {
  const platform = createBasicPlatform();
  platform.requests.fetch.mockImplementation(() =>
    Promise.resolve({ status: 200, headers: new Headers() }),
  );

  const client = new LDClientImpl(
    'sdk-key-user-agent-3',
    platform,
    { logger: new TestLogger(), stream: false },
    makeCallbacks(false),
  );

  client.identify({ key: 'user' });
  await client.flush();

  expect(platform.requests.fetch).toHaveBeenCalledWith(
    'https://events.launchdarkly.com/bulk',
    expect.objectContaining({
      headers: expect.objectContaining({
        'user-agent': expect.anything(),
      }),
    }),
  );

  client.close();
});
