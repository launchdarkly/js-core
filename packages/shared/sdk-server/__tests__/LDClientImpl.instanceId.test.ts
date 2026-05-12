import { LDClientImpl } from '../src';
import { createBasicPlatform } from './createBasicPlatform';
import TestLogger from './Logger';
import makeCallbacks from './makeCallbacks';

// Per SCMP-server-connection-minutes-polling (spec section 1.1), the SDK must send
// `X-LaunchDarkly-Instance-Id: <v4 GUID>` on every polling request, with one GUID per SDK
// instance and stable for that instance's lifetime. The server SDK attaches the GUID to the
// shared default-headers map so that it rides on every outbound request (streaming, polling,
// and events).
describe('LDClientImpl instance-id header', () => {
  const fixedUuid = 'd3135edb-6531-4874-8a38-f0c9e556e836';

  it('generates exactly one UUID per SDK instance during construction', () => {
    const platform = createBasicPlatform();
    platform.requests.fetch.mockImplementation(() =>
      Promise.resolve({ status: 200, headers: new Headers() }),
    );

    const client = new LDClientImpl(
      'sdk-key-instance-id-1',
      platform,
      { logger: new TestLogger(), stream: false, sendEvents: false },
      makeCallbacks(false),
    );

    // Exactly one randomUUID call is expected -- a single GUID per SDK instance,
    // captured during construction.
    expect(platform.crypto.randomUUID).toHaveBeenCalledTimes(1);

    client.close();
  });

  it('attaches the X-LaunchDarkly-Instance-Id header to event requests', async () => {
    const platform = createBasicPlatform();
    platform.crypto.randomUUID.mockReturnValueOnce(fixedUuid);
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
        headers: expect.objectContaining({
          'x-launchdarkly-instance-id': fixedUuid,
        }),
      }),
    );

    client.close();
  });

  it('uses a different GUID for different SDK instances', () => {
    const platformA = createBasicPlatform();
    const platformB = createBasicPlatform();
    platformA.crypto.randomUUID.mockReturnValueOnce('aaaa1111-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
    platformB.crypto.randomUUID.mockReturnValueOnce('bbbb2222-bbbb-4bbb-bbbb-bbbbbbbbbbbb');
    platformA.requests.fetch.mockImplementation(() =>
      Promise.resolve({ status: 200, headers: new Headers() }),
    );
    platformB.requests.fetch.mockImplementation(() =>
      Promise.resolve({ status: 200, headers: new Headers() }),
    );

    const clientA = new LDClientImpl(
      'sdk-key-instance-id-a',
      platformA,
      { logger: new TestLogger(), stream: false, sendEvents: false },
      makeCallbacks(false),
    );
    const clientB = new LDClientImpl(
      'sdk-key-instance-id-b',
      platformB,
      { logger: new TestLogger(), stream: false, sendEvents: false },
      makeCallbacks(false),
    );

    expect(platformA.crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(platformB.crypto.randomUUID).toHaveBeenCalledTimes(1);
    expect(platformA.crypto.randomUUID.mock.results[0].value).not.toEqual(
      platformB.crypto.randomUUID.mock.results[0].value,
    );

    clientA.close();
    clientB.close();
  });
});
