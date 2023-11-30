import { type LDContext } from '@launchdarkly/js-client-sdk-common';

import ReactNativeLDClient from './ReactNativeLDClient';

describe('ReactNativeLDClient', () => {
  let ldc: ReactNativeLDClient;

  beforeEach(() => {
    ldc = new ReactNativeLDClient('mob-test', { sendEvents: false });
  });

  test('constructor', () => {
    expect(ldc.sdkKey).toEqual('mob-test');
  });

  test('createStreamUriPath', () => {
    const context: LDContext = { kind: 'user', key: 'test-user-key-1' };

    expect(ldc.createStreamUriPath(context)).toEqual(
      '/meval/eyJraW5kIjoidXNlciIsImtleSI6InRlc3QtdXNlci1rZXktMSJ9',
    );
  });
});
