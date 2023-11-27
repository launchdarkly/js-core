import { internal } from '@launchdarkly/js-server-sdk-common';
import { basicPlatform } from '@launchdarkly/private-js-mocks';

import LDClient from './LDClient';

jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');
  return {
    ...actual,
    ...{
      internal: {
        ...actual.internal,
        DiagnosticsManager: jest.fn(),
        EventProcessor: jest.fn(),
      },
    },
  };
});

const mockEventProcessor = internal.EventProcessor as jest.Mock;
describe('Edge LDClient', () => {
  it('uses clientSideID endpoints', async () => {
    const client = new LDClient('client-side-id', basicPlatform.info, {
      sendEvents: true,
    });
    await client.waitForInitialization();
    const passedConfig = mockEventProcessor.mock.calls[0][0];

    expect(passedConfig).toMatchObject({
      sendEvents: true,
      serviceEndpoints: {
        includeAuthorizationHeader: false,
        analyticsEventPath: '/events/bulk/client-side-id',
        diagnosticEventPath: '/events/diagnostic/client-side-id',
        events: 'https://events.launchdarkly.com',
        polling: 'https://sdk.launchdarkly.com',
        streaming: 'https://stream.launchdarkly.com',
      },
    });
  });
});
