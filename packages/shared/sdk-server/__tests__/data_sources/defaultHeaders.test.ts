import { Info, PlatformData, SdkData } from '@launchdarkly/js-sdk-common';

import defaultHeaders from '../../src/data_sources/defaultHeaders';
import Configuration from '../../src/options/Configuration';

const makeInfo = (wrapperName?: string, wrapperVersion?: string, userAgentBase?: string): Info => ({
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
  const config = new Configuration({});
  const h = defaultHeaders('sdk-my-sdk-key', config, makeInfo());
  expect(h).toMatchObject({ authorization: 'sdk-my-sdk-key' });
});

it('sets the default user agent', () => {
  const config = new Configuration({});
  const h = defaultHeaders('sdk-my-sdk-key', config, makeInfo());
  expect(h).toMatchObject({ 'user-agent': 'NodeJSClient/2.2.2' });
});

it('sets the SDK specific user agent', () => {
  const config = new Configuration({});
  const h = defaultHeaders('sdk-my-sdk-key', config, makeInfo(undefined, undefined, 'CATS'));
  expect(h).toMatchObject({ 'user-agent': 'CATS/2.2.2' });
});

it('does not include wrapper header by default', () => {
  const config = new Configuration({});
  const h = defaultHeaders('sdk-my-sdk-key', config, makeInfo());
  expect(h['x-launchdarkly-wrapper']).toBeUndefined();
});

it('sets wrapper header with name only', () => {
  const config = new Configuration({});
  const h = defaultHeaders('sdk-my-sdk-key', config, makeInfo('my-wrapper'));
  expect(h).toMatchObject({ 'x-launchdarkly-wrapper': 'my-wrapper' });
});

it('sets wrapper header with name and version', () => {
  const config = new Configuration({});
  const h = defaultHeaders('sdk-my-sdk-key', config, makeInfo('my-wrapper', '2.0'));
  expect(h).toMatchObject({ 'x-launchdarkly-wrapper': 'my-wrapper/2.0' });
});

it('sets the X-LaunchDarkly-Tags header with valid tags.', () => {
  const config = new Configuration({
    application: {
      id: 'test-application',
      version: 'test-version',
    },
  });
  const h = defaultHeaders('sdk-my-sdk-key', config, makeInfo('my-wrapper'));
  expect(h).toMatchObject({
    'x-launchdarkly-tags': 'application-id/test-application application-version/test-version',
  });
});
