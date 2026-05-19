import { LDClientImpl } from '../src';
import { createBasicPlatform } from './createBasicPlatform';
import TestLogger from './Logger';
import makeCallbacks from './makeCallbacks';

// When `internalOptions.instanceId` is supplied, the SDK must attach
// `X-LaunchDarkly-Instance-Id` to every outbound request using that value. When it is
// omitted, the header must not be attached. The platform SDK that owns instance-id
// generation (e.g. the Node server SDK) is responsible for producing the GUID and
// passing it through `internalOptions`.
describe('LDClientImpl instance-id header', () => {
  const fixedUuid = 'd3135edb-6531-4874-8a38-f0c9e556e836';

  it('attaches the X-LaunchDarkly-Instance-Id header when internalOptions.instanceId is set', async () => {
    const platform = createBasicPlatform();
    platform.requests.fetch.mockImplementation(() =>
      Promise.resolve({ status: 200, headers: new Headers() }),
    );

    const client = new LDClientImpl(
      'sdk-key-instance-id-1',
      platform,
      { logger: new TestLogger(), stream: false },
      makeCallbacks(false),
      { instanceId: fixedUuid },
    );

    client.identify({ key: 'user' });
    client.variation('dev-test-flag', { key: 'user' }, false);
    await client.flush();

    expect(platform.requests.fetch).toHaveBeenCalledWith(
      'https://events.launchdarkly.com/bulk',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-launchdarkly-instance-id': fixedUuid,
        }),
      }),
    );

    client.close();
  });

  it('omits the X-LaunchDarkly-Instance-Id header when no instanceId is supplied', async () => {
    const platform = createBasicPlatform();
    platform.requests.fetch.mockImplementation(() =>
      Promise.resolve({ status: 200, headers: new Headers() }),
    );

    const client = new LDClientImpl(
      'sdk-key-instance-id-2',
      platform,
      { logger: new TestLogger(), stream: false },
      makeCallbacks(false),
    );

    client.identify({ key: 'user' });
    client.variation('dev-test-flag', { key: 'user' }, false);
    await client.flush();

    expect(platform.requests.fetch).toHaveBeenCalledWith(
      'https://events.launchdarkly.com/bulk',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          'x-launchdarkly-instance-id': expect.anything(),
        }),
      }),
    );

    client.close();
  });
});
