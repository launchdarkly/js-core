import { Info, PlatformData, SdkData } from '../api';
import { ApplicationTags } from '../options';
import { defaultHeaders } from './http';

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
  // TODO:
});
