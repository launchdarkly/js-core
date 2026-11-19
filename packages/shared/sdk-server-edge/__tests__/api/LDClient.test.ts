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

const mockEventProcessor = internal.EventProcessor as jest.Mock;

it.each([
  [{ wrapperName: 'test-wrapper', wrapperVersion: '1.0.0' }, 'test-wrapper/1.0.0'],
  [{ wrapperName: 'test-wrapper' }, 'test-wrapper'],
  [{ wrapperVersion: '1.0.0' }, undefined],
  [{}, undefined],
] as const)('sets the wrapper header for options %p', async (options, expectedHeader) => {
  mockEventProcessor.mockClear();
  const client = new LDClient('client-side-id', createBasicPlatform().info, {
    sendEvents: true,
    ...options,
  });
  await client.waitForInitialization({ timeout: 10 });

  expect(mockEventProcessor.mock.calls[0][2]['x-launchdarkly-wrapper']).toBe(expectedHeader);
});

describe('Edge LDClient', () => {
  it('uses clientSideID endpoints', async () => {
    const client = new LDClient('client-side-id', createBasicPlatform().info, {
      sendEvents: true,
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
});
