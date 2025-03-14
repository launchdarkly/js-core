import { internal } from '@launchdarkly/js-server-sdk-common';

import LDClient from '../../src/api/LDClient';
import { createBasicPlatform } from '../createBasicPlatform';

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

let mockEventProcessor = internal.EventProcessor as jest.Mock;
beforeEach(() => {
  mockEventProcessor = internal.EventProcessor as jest.Mock;
  mockEventProcessor.mockClear();
});

describe('Edge LDClient', () => {
  it('uses clientSideID endpoints', async () => {
    const client = new LDClient('client-side-id', createBasicPlatform().info, {
      sendEvents: true,
      eventsBackendName: 'launchdarkly',
    });
    await client.waitForInitialization({ timeout: 10 });
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
  it('uses custom eventsUri when specified', async () => {
    const client = new LDClient('client-side-id', createBasicPlatform().info, {
      sendEvents: true,
      eventsBackendName: 'launchdarkly',
      eventsUri: 'https://custom-base-uri.launchdarkly.com',
    });
    await client.waitForInitialization({ timeout: 10 });
    const passedConfig = mockEventProcessor.mock.calls[0][0];

    expect(passedConfig).toMatchObject({
      sendEvents: true,
      serviceEndpoints: {
        includeAuthorizationHeader: false,
        analyticsEventPath: '/events/bulk/client-side-id',
        diagnosticEventPath: '/events/diagnostic/client-side-id',
        events: 'https://custom-base-uri.launchdarkly.com',
        polling: 'https://custom-base-uri.launchdarkly.com',
        streaming: 'https://stream.launchdarkly.com',
      },
    });
  });
});
