import { Info, PlatformData, SdkData } from '../api';
import { ApplicationTags } from '../options';
import { defaultHeaders, httpErrorMessage, shouldRetry } from './http';

describe('defaultHeaders', () => {
  const makeInfo = (
    wrapperName?: string,
    wrapperVersion?: string,
    userAgentBase?: string,
  ): Info => ({
    platformData(): PlatformData {
      return {};
    },
    sdkData(): SdkData {
      const sdkData: SdkData = {
        version: '2.2.2',
        userAgentBase,
        wrapperName,
        wrapperVersion,
      };
      return sdkData;
    },
  });

  it('sets SDK key', () => {
    const h = defaultHeaders('my-sdk-key', makeInfo());
    expect(h).toMatchObject({ authorization: 'my-sdk-key' });
  });

  it('sets the default user agent', () => {
    const h = defaultHeaders('my-sdk-key', makeInfo());
    expect(h).toMatchObject({ 'user-agent': 'NodeJSClient/2.2.2' });
  });

  it('sets the SDK specific user agent', () => {
    const h = defaultHeaders('my-sdk-key', makeInfo(undefined, undefined, 'CATS'));
    expect(h).toMatchObject({ 'user-agent': 'CATS/2.2.2' });
  });

  it('does not include wrapper header by default', () => {
    const h = defaultHeaders('my-sdk-key', makeInfo());
    expect(h['x-launchdarkly-wrapper']).toBeUndefined();
  });

  it('sets wrapper header with name only', () => {
    const h = defaultHeaders('my-sdk-key', makeInfo('my-wrapper'));
    expect(h).toMatchObject({ 'x-launchdarkly-wrapper': 'my-wrapper' });
  });

  it('sets wrapper header with name and version', () => {
    const h = defaultHeaders('my-sdk-key', makeInfo('my-wrapper', '2.0'));
    expect(h).toMatchObject({ 'x-launchdarkly-wrapper': 'my-wrapper/2.0' });
  });

  it('sets the X-LaunchDarkly-Tags header with valid tags.', () => {
    const tags = new ApplicationTags({
      application: {
        id: 'test-application',
        version: 'test-version',
      },
    });
    const h = defaultHeaders('my-sdk-key', makeInfo('my-wrapper'), tags);
    expect(h).toMatchObject({
      'x-launchdarkly-tags': 'application-id/test-application application-version/test-version',
    });
  });
});

describe('httpErrorMessage', () => {
  test('I/O error', () => {
    const error = { status: undefined, message: 'no status' };
    const context = 'fake error context message';
    const retryMessage = undefined;

    // @ts-ignore
    const result = httpErrorMessage(error, context, retryMessage);

    expect(result).toBe(
      'Received I/O error (no status) for fake error context message - giving up permanently',
    );
  });

  test('invalid sdk key', () => {
    const error = { status: 401, message: 'denied' };
    const context = 'fake error context message';
    const retryMessage = undefined;

    // @ts-ignore
    const result = httpErrorMessage(error, context, retryMessage);

    expect(result).toBe(
      'Received error 401 (invalid SDK key) for fake error context message - giving up permanently',
    );
  });

  test('non-401 errors', () => {
    const error = { status: 500, message: 'server error' };
    const context = 'fake error context message';
    const retryMessage = undefined;

    // @ts-ignore
    const result = httpErrorMessage(error, context, retryMessage);

    expect(result).toBe(
      'Received error 500 for fake error context message - giving up permanently',
    );
  });

  test('with retry message', () => {
    const error = { status: 500, message: 'denied' };
    const context = 'fake error context message';
    const retryMessage = 'will retry';

    // @ts-ignore
    const result = httpErrorMessage(error, context, retryMessage);

    expect(result).toBe('Received error 500 for fake error context message - will retry');
  });

  test('should retry', () => {
    const error = { status: 500, message: 'denied' };
    const result = shouldRetry(error);

    expect(result).toBeTruthy();
  });

  test('status undefined, should retry', () => {
    const error = { message: 'custom error' };
    const result = shouldRetry(error);

    expect(result).toBeTruthy();
  });

  test('should not retry', () => {
    const error = { status: 401, message: 'unauthorized' };
    const result = shouldRetry(error);

    expect(result).toBeFalsy();
  });
});
