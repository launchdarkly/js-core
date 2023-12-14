import { type LDContext } from '@launchdarkly/js-client-sdk-common';

import ReactNativeLDClient from './ReactNativeLDClient';

describe('ReactNativeLDClient', () => {
  let ldc: ReactNativeLDClient;

  beforeEach(() => {
    ldc = new ReactNativeLDClient('mob-test', { sendEvents: false });
  });

  test('constructing a new client', () => {
    expect(ldc.sdkKey).toEqual('mob-test');
    expect(ldc.config.serviceEndpoints).toEqual({
      analyticsEventPath: '/mobile',
      diagnosticEventPath: '/mobile/events/diagnostic',
      events: 'https://events.launchdarkly.com',
      includeAuthorizationHeader: true,
      polling: 'https://sdk.launchdarkly.com',
      streaming: 'https://clientstream.launchdarkly.com',
    });
  });

  test('createStreamUriPath', () => {
    const context: LDContext = { kind: 'user', key: 'test-user-key-1' };

    expect(ldc.createStreamUriPath(context)).toEqual(
      '/meval/eyJraW5kIjoidXNlciIsImtleSI6InRlc3QtdXNlci1rZXktMSJ9',
    );
  });
});
