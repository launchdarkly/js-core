import createPlatformInfo from '../src/createPlatformInfo';

const version = '0.1.2'; // x-release-please-version

describe('Fastly Platform Info', () => {
  it('platformData shows correct information', () => {
    const platformData = createPlatformInfo();

    expect(platformData.platformData()).toEqual({
      name: 'Fastly Compute',
    });

    expect(platformData.sdkData()).toEqual({
      name: '@launchdarkly/fastly-server-sdk',
      version,
      userAgentBase: 'FastlyEdgeSDK',
    });
  });
});
